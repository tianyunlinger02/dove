import process from "node:process";

import { dispatchTool } from "./handlers.mjs";
import {
  toolDefinitions,
  toolDiscoveryInputSchema
} from "./tool-definitions.mjs";

const ELICITATION_PROTOCOL_VERSIONS = new Set([
  "2025-06-18",
  "2025-11-25"
]);

function protocolError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function invalidParams(message) {
  return protocolError(-32602, message);
}

function notInitialized() {
  return protocolError(-32002, "MCP server is not initialized.");
}

function normalizeToolDiscoveryParams(params) {
  if (params === undefined) return {};
  if (!params || typeof params !== "object" || Array.isArray(params)) throw invalidParams("tools/list params must be a plain object.");
  const allowed = new Set(Object.keys(toolDiscoveryInputSchema.properties ?? {}));
  const unknown = Object.keys(params).filter((key) => !allowed.has(key));
  if (unknown.length > 0) throw invalidParams(`tools/list does not accept unknown input: ${unknown.map((key) => `$.${key}`).join(", ")}.`);
  return params;
}

function approvalMessage(approval) {
  return [
    approval.summary,
    ...(approval.effects ?? []).map((effect) => `- ${effect}`),
    approval.question
  ].filter(Boolean).join("\n");
}

export function startServer(root = process.cwd()) {
  let buffer = Buffer.alloc(0);
  let responseFraming = "content-length";
  let nextRequestId = 1;
  let clientProtocolVersion = null;
  let clientCapabilities = {};
  let initialized = false;
  const pending = new Map();

  function sendMessage(message) {
    const body = JSON.stringify(message);
    if (responseFraming === "jsonl") {
      process.stdout.write(`${body}\n`);
      return;
    }
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
  }

  function sendResponse(id, result) {
    sendMessage({ jsonrpc: "2.0", id, result });
  }

  function sendError(id, code, message) {
    sendMessage({ jsonrpc: "2.0", id, error: { code, message } });
  }

  function supportsElicitation() {
    return initialized && ELICITATION_PROTOCOL_VERSIONS.has(clientProtocolVersion) && clientCapabilities?.elicitation !== undefined;
  }

  function requestClient(method, params) {
    const id = `dove-${nextRequestId++}`;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      sendMessage({ jsonrpc: "2.0", id, method, params });
    });
  }

  async function requestCheckpointApproval(approval) {
    if (!supportsElicitation()) throw new Error("This Dove checkpoint requires MCP elicitation support.");
    const response = await requestClient("elicitation/create", {
      message: approvalMessage(approval),
      requestedSchema: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    });
    return response?.action;
  }

  function resolveClientResponse(message) {
    const waiter = pending.get(message.id);
    if (!waiter) return false;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message ?? "MCP client request failed."));
    else waiter.resolve(message.result);
    return true;
  }

  async function handleMessage(message) {
    if (message?.id !== undefined && message?.method === undefined && resolveClientResponse(message)) return;
    const { id, method, params } = message ?? {};

    if (method === "notifications/initialized") {
      if (clientProtocolVersion === null) return;
      initialized = true;
      return;
    }

    if (method === "initialize") {
      if (clientProtocolVersion !== null) throw protocolError(-32600, "MCP server is already initialized.");
      clientProtocolVersion = params?.protocolVersion ?? null;
      clientCapabilities = params?.capabilities ?? {};
      sendResponse(id, {
        protocolVersion: ELICITATION_PROTOCOL_VERSIONS.has(clientProtocolVersion) ? clientProtocolVersion : "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "dove", version: "0.4.0" }
      });
      return;
    }

    if (method === "ping") {
      sendResponse(id, {});
      return;
    }

    if (method === "tools/list" || method === "tools/call") {
      if (!initialized) throw notInitialized();
    }

    if (method === "tools/list") {
      normalizeToolDiscoveryParams(params);
      sendResponse(id, { tools: toolDefinitions });
      return;
    }

    if (method === "tools/call") {
      sendResponse(id, await dispatchTool(root, params?.name, params?.arguments ?? {}, { requestCheckpointApproval }));
      return;
    }

    if (id !== undefined) sendError(id, -32601, `Method not found: ${method}`);
  }

  function handleJsonText(body) {
    let message;
    try {
      message = JSON.parse(body);
    } catch {
      return;
    }
    handleMessage(message).catch((error) => {
      if (message?.id !== undefined && message?.method !== undefined) {
        const code = Number.isInteger(error?.code) ? error.code : -32603;
        sendError(message.id, code, code !== -32603 && error instanceof Error ? error.message : "Internal error");
      }
    });
  }

  function parseContentLengthMessage() {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) return false;
    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) return false;
    const length = Number(match[1]);
    const totalLength = headerEnd + 4 + length;
    if (buffer.length < totalLength) return false;
    responseFraming = "content-length";
    handleJsonText(buffer.slice(headerEnd + 4, totalLength).toString("utf8"));
    buffer = buffer.slice(totalLength);
    return true;
  }

  function parseJsonLineMessage() {
    const lineEnd = buffer.indexOf("\n");
    if (lineEnd === -1) return false;
    responseFraming = "jsonl";
    const body = buffer.slice(0, lineEnd).toString("utf8").trim();
    buffer = buffer.slice(lineEnd + 1);
    if (body) handleJsonText(body);
    return true;
  }

  function parseMessages() {
    while (buffer.length > 0) {
      const prefix = buffer.toString("utf8", 0, Math.min(buffer.length, 32)).trimStart();
      const parsed = prefix.startsWith("{") ? parseJsonLineMessage() : parseContentLengthMessage();
      if (!parsed) return;
    }
  }

  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    parseMessages();
  });

  process.stdin.on("end", () => {
    for (const waiter of pending.values()) waiter.reject(new Error("MCP client disconnected before checkpoint approval completed."));
    pending.clear();
    process.exit(0);
  });
}
