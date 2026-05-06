import assert from "node:assert/strict";
import { spawn } from "node:child_process";

export const CALL_TIMEOUT_MS = 15000;

export function createMcpStdioClient({ args, cwd, command = "node", timeoutMs = CALL_TIMEOUT_MS }) {
  const server = spawn(command, args, {
    cwd,
    stdio: ["pipe", "pipe", "inherit"]
  });
  let buffer = Buffer.alloc(0);
  let nextId = 1;
  const pending = new Map();

  function sendMessage(message) {
    const body = JSON.stringify(message);
    server.stdin.write(`Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`);
  }

  function call(method, params = {}, label = null) {
    const id = nextId++;
    const callLabel = label ?? (method === "tools/call" && params?.name ? `${method}:${params.name}` : method);
    const promise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        server.kill();
        reject(new Error(`MCP call timed out after ${timeoutMs}ms: ${callLabel}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, method, label: callLabel });
    });
    sendMessage({ jsonrpc: "2.0", id, method, params });
    return promise;
  }

  function notify(method, params = {}) {
    sendMessage({ jsonrpc: "2.0", method, params });
  }

  function parseMessages() {
    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        return;
      }
      const headerText = buffer.slice(0, headerEnd).toString("utf8");
      const match = headerText.match(/Content-Length:\s*(\d+)/i);
      assert.ok(match, "Missing Content-Length header from MCP server");
      const length = Number(match[1]);
      const totalLength = headerEnd + 4 + length;
      if (buffer.length < totalLength) {
        return;
      }
      const body = buffer.slice(headerEnd + 4, totalLength).toString("utf8");
      buffer = buffer.slice(totalLength);
      const message = JSON.parse(body);
      const waiter = pending.get(message.id);
      if (!waiter) {
        continue;
      }
      pending.delete(message.id);
      clearTimeout(waiter.timer);
      if (message.error) {
        waiter.reject(new Error(`${waiter.label}: ${message.error.message}`));
      } else {
        waiter.resolve(message.result);
      }
    }
  }

  server.stdout.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    parseMessages();
  });

  server.on("exit", (code) => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error(`MCP server exited early during ${waiter.label} with code ${code}`));
    }
    pending.clear();
  });

  return {
    call,
    notify,
    kill: () => server.kill(),
    server
  };
}
