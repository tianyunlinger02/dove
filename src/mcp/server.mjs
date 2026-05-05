import process from "node:process";

import { ensureWorkspace } from "../core/index.mjs";
import { dispatchTool } from "./handlers.mjs";
import { toolDefinitions } from "./tool-definitions.mjs";

export function startServer(root = process.cwd()) {
  ensureWorkspace(root);

  let buffer = Buffer.alloc(0);

  function sendMessage(message) {
    const body = JSON.stringify(message);
    process.stdout.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
  }

  function sendResponse(id, result) {
    sendMessage({ jsonrpc: "2.0", id, result });
  }

  function sendError(id, code, message) {
    sendMessage({ jsonrpc: "2.0", id, error: { code, message } });
  }

  function handleMessage(message) {
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
      sendResponse(id, { tools: toolDefinitions });
      return;
    }

    if (method === "tools/call") {
      sendResponse(id, dispatchTool(root, params?.name, params?.arguments ?? {}));
      return;
    }

    if (id !== undefined) {
      sendError(id, -32601, `Method not found: ${method}`);
    }
  }

  function parseMessages() {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }

      const headerText = buffer.slice(0, headerEnd).toString("utf8");
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = Buffer.alloc(0);
        return;
      }

      const length = Number(match[1]);
      const totalLength = headerEnd + 4 + length;
      if (buffer.length < totalLength) {
        return;
      }

      const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
      buffer = buffer.slice(totalLength);

      try {
        handleMessage(JSON.parse(body));
      } catch {
        // ignore malformed inbound messages
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
