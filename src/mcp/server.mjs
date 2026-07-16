import process from "node:process";

import { dispatchTool } from "./handlers.mjs";
import {
  toolDefinitions,
  toolDiscoveryInputSchema
} from "./tool-definitions.mjs";

function invalidParams(message) {
  const error = new Error(message);
  error.code = -32602;
  return error;
}

function normalizeToolDiscoveryParams(params) {
  if (params === undefined) {
    return {};
  }
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    throw invalidParams("tools/list params must be a plain object.");
  }
  const allowed = new Set(
    Object.keys(toolDiscoveryInputSchema.properties ?? {})
  );
  const unknown = Object.keys(params)
    .filter((key) => !allowed.has(key));
  if (unknown.length > 0) {
    throw invalidParams(
      `tools/list does not accept unknown input: ` +
      `${unknown.map((key) => `$.${key}`).join(", ")}.`
    );
  }
  const resultMode = params.resultMode;
  if (
    resultMode !== undefined
    && !toolDiscoveryInputSchema.properties.resultMode.enum.includes(resultMode)
  ) {
    throw invalidParams(
      `tools/list resultMode must be one of: ` +
      `${toolDiscoveryInputSchema.properties.resultMode.enum.join(", ")}.`
    );
  }
  return params;
}

export function startServer(root = process.cwd()) {
  let buffer = Buffer.alloc(0);
  let responseFraming = "content-length";

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

  async function handleMessage(message) {
    const { id, method, params } = message ?? {};

    if (method === "notifications/initialized") {
      return;
    }

    if (method === "initialize") {
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "dove", version: "0.2.0" }
      });
      return;
    }

    if (method === "ping") {
      sendResponse(id, {});
      return;
    }

    if (method === "tools/list") {
      normalizeToolDiscoveryParams(params);
      sendResponse(id, {
        tools: toolDefinitions
      });
      return;
    }

    if (method === "tools/call") {
      sendResponse(id, await dispatchTool(root, params?.name, params?.arguments ?? {}));
      return;
    }

    if (id !== undefined) {
      sendError(id, -32601, `Method not found: ${method}`);
    }
  }

  function handleJsonText(body) {
    let message;
    try {
      message = JSON.parse(body);
    } catch {
      return;
    }
    handleMessage(message).catch((error) => {
      if (message?.id !== undefined) {
        const code = Number.isInteger(error?.code)
          ? error.code
          : -32603;
        sendError(
          message.id,
          code,
          code === -32602 && error instanceof Error
            ? error.message
            : "Internal error"
        );
      }
    });
  }

  function parseContentLengthMessage() {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return false;
    }

    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const match = headerText.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      return false;
    }

    const length = Number(match[1]);
    const totalLength = headerEnd + 4 + length;
    if (buffer.length < totalLength) {
      return false;
    }

    responseFraming = "content-length";
    handleJsonText(buffer.slice(headerEnd + 4, totalLength).toString("utf8"));
    buffer = buffer.slice(totalLength);
    return true;
  }

  function parseJsonLineMessage() {
    const lineEnd = buffer.indexOf("\n");
    if (lineEnd === -1) {
      return false;
    }

    responseFraming = "jsonl";
    const body = buffer.slice(0, lineEnd).toString("utf8").trim();
    buffer = buffer.slice(lineEnd + 1);
    if (body) {
      handleJsonText(body);
    }
    return true;
  }

  function parseMessages() {
    while (buffer.length > 0) {
      const prefix = buffer.toString("utf8", 0, Math.min(buffer.length, 32)).trimStart();
      const parsed = prefix.startsWith("{") ? parseJsonLineMessage() : parseContentLengthMessage();
      if (!parsed) {
        return;
      }
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
