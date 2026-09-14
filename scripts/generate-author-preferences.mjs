import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_PATH = "docs/AUTHOR_PREFERENCES.md";
const GENERATED_PATH = "src/core/dove-author-preferences-content.generated.mjs";

export function renderAuthorPreferencesContentModule(content) {
  return `// Generated from ${SOURCE_PATH} by npm run commands:generate. Do not edit.\nexport const DOVE_AUTHOR_PREFERENCES_CONTENT = ${JSON.stringify(content)};\n`;
}

export function checkGeneratedAuthorPreferencesContent(root = PACKAGE_ROOT) {
  const content = renderAuthorPreferencesContentModule(fs.readFileSync(path.join(root, SOURCE_PATH), "utf8"));
  const target = path.join(root, GENERATED_PATH);
  if (!fs.existsSync(target)) return [{ relativePath: GENERATED_PATH, reason: "missing" }];
  return fs.readFileSync(target, "utf8") === content
    ? []
    : [{ relativePath: GENERATED_PATH, reason: "content differs" }];
}

export function writeGeneratedAuthorPreferencesContent(root = PACKAGE_ROOT) {
  const content = renderAuthorPreferencesContentModule(fs.readFileSync(path.join(root, SOURCE_PATH), "utf8"));
  fs.writeFileSync(path.join(root, GENERATED_PATH), content, "utf8");
  return { writtenPaths: [GENERATED_PATH] };
}
