import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { loadDoveLanguageConfig, loadExplicitDoveLanguageConfig } from "../../src/core/config.mjs";
import { resolveDoveResponseLanguage } from "../../src/core/i18n.mjs";
import { createTempRoot } from "../helpers/temp-root.mjs";

function writeConfig(root, value) {
  const configPath = path.join(root, ".dove", "config.json");
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isolatedEnv(root, overrides = {}) {
  return { XDG_CONFIG_HOME: path.join(root, "xdg"), ...overrides };
}

test("response language defaults to Chinese and explicit renderer language wins", () => {
  const root = createTempRoot("dove-i18n-default-");
  const env = isolatedEnv(root);
  assert.equal(resolveDoveResponseLanguage(root, {}, { env }), "zh");
  assert.equal(resolveDoveResponseLanguage(root, { language: "en" }, { env }), "en");
});

test("language config and DOVE_LANGUAGE are the only configuration inputs", () => {
  const root = createTempRoot("dove-i18n-config-");
  writeConfig(root, { language: "en" });
  assert.equal(loadExplicitDoveLanguageConfig(root, isolatedEnv(root)), "en");
  assert.equal(loadDoveLanguageConfig(root, isolatedEnv(root)), "en");
  assert.equal(resolveDoveResponseLanguage(root, {}, { env: isolatedEnv(root, { DOVE_LANGUAGE: "zh" }) }), "zh");
});

test("retired responseLanguage aliases do not create a second language source", () => {
  const root = createTempRoot("dove-i18n-retired-alias-");
  writeConfig(root, { responseLanguage: "en" });
  const env = isolatedEnv(root, { DOVE_RESPONSE_LANGUAGE: "en" });
  assert.equal(loadExplicitDoveLanguageConfig(root, env), null);
  assert.equal(loadDoveLanguageConfig(root, env), "zh");
  assert.equal(resolveDoveResponseLanguage(root, { responseLanguage: "en" }, { env }), "zh");
});
