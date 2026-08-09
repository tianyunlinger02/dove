import test from "node:test";
import assert from "node:assert/strict";

import {
  DOVE_PIXEL_ART,
  isInteractiveTerminal,
  renderDoveHome,
  renderDovePixelArt,
  terminalColorEnabled
} from "../../src/cli/terminal-output.mjs";

const ANSI_PATTERN = /\[/u;

test("terminal capability requires a real TTY and respects NO_COLOR", () => {
  assert.equal(isInteractiveTerminal({ isTTY: true }), true);
  assert.equal(isInteractiveTerminal({ isTTY: false }), false);
  assert.equal(isInteractiveTerminal({}), false);
  assert.equal(terminalColorEnabled({ isTTY: true }, {}), true);
  assert.equal(terminalColorEnabled({ isTTY: true }, { NO_COLOR: "1" }), false);
  assert.equal(terminalColorEnabled({ isTTY: true }, { NO_COLOR: "" }), true);
  assert.equal(terminalColorEnabled({ isTTY: false }, {}), false);
});

test("original Dove pixel art remains visible with or without color", () => {
  const plain = renderDovePixelArt({ color: false });
  const colored = renderDovePixelArt({ color: true });
  assert.equal(plain, DOVE_PIXEL_ART.join("\n"));
  assert.doesNotMatch(plain, ANSI_PATTERN);
  assert.match(colored, ANSI_PATTERN);
  for (const line of DOVE_PIXEL_ART) assert.ok(colored.includes(line));
});

test("Dove home shows the mascot only in an interactive terminal", () => {
  const interactive = renderDoveHome({ stream: { isTTY: true }, env: {}, projectInitialized: true });
  assert.ok(interactive.includes(DOVE_PIXEL_ART[0]));
  assert.match(interactive, /围绕科研主线探索/u);
  assert.match(interactive, /项目集成已是当前版本/u);
  assert.match(interactive, /\/dove:research/u);
  assert.match(interactive, /dove --help/u);

  const piped = renderDoveHome({ stream: { isTTY: false }, env: {}, projectInitialized: false });
  assert.equal(piped.includes(DOVE_PIXEL_ART[0]), false);
  assert.doesNotMatch(piped, ANSI_PATTERN);
  assert.match(piped, /尚未配置 Dove/u);
  assert.match(piped, /下一步  dove/u);
});
