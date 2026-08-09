import process from "node:process";

import { dispatchTool } from "./handlers.mjs";
import {
  DOVE_MCP_PROTOCOL_VERSIONS,
  inspectRunningMcpRuntime,
  negotiateDoveMcpProtocol
} from "./runtime-info.mjs";
import {
  toolDefinitions,
  toolDiscoveryInputSchema
} from "./tool-definitions.mjs";

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

export function startServer(root = process.cwd()) {
  let buffer = Buffer.alloc(0);
  let responseFraming = "content-length";
  let clientProtocolVersion = null;
  let initialized = false;

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

  function publicSafeToolFailure() {
    const message = "Dove 工具未能安全返回结果；没有记录任何研究判断或评审权威。";
    return {
      content: [{ type: "text", text: message }],
      structuredContent: { status: "error", operation: "unknown", research: { message } },
      isError: true
    };
  }

  async function handleMessage(message) {
    const { id, method, params } = message ?? {};

    if (method === "notifications/initialized") {
      if (clientProtocolVersion === null) return;
      initialized = true;
      return;
    }

    if (method === "initialize") {
      if (clientProtocolVersion !== null) throw protocolError(-32600, "MCP server is already initialized.");
      clientProtocolVersion = params?.protocolVersion ?? null;
      sendResponse(id, {
        protocolVersion: negotiateDoveMcpProtocol(clientProtocolVersion),
        capabilities: { tools: {} },
        serverInfo: { name: "dove", version: inspectRunningMcpRuntime(root, negotiateDoveMcpProtocol(clientProtocolVersion)).serverInfo.version }
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
      const toolName = params?.name;
      const toolArgs = params?.arguments ?? {};
      sendResponse(id, await dispatchTool(root, toolName, toolArgs, {
        negotiatedProtocolVersion: negotiateDoveMcpProtocol(clientProtocolVersion)
      }));
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
      if (message?.id === undefined || message?.method === undefined) return;
      const code = Number.isInteger(error?.code) ? error.code : -32603;
      if (message.method === "tools/call" && code === -32603) {
        sendResponse(message.id, publicSafeToolFailure());
        return;
      }
      sendError(message.id, code, code !== -32603 && error instanceof Error ? error.message : "Internal error");
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
    process.exit(0);
  });
}
