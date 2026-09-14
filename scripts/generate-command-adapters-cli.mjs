#!/usr/bin/env node

import process from "node:process";

import { checkGeneratedAuthorPreferencesContent, writeGeneratedAuthorPreferencesContent } from "./generate-author-preferences.mjs";

const check = process.argv.includes("--check");
const contentDrift = check ? checkGeneratedAuthorPreferencesContent() : [];
if (contentDrift.length > 0) {
  for (const item of contentDrift) console.error(`${item.relativePath}: ${item.reason}`);
  process.exit(1);
}
const contentTransaction = check ? null : writeGeneratedAuthorPreferencesContent();
// Load renderers only after generating or checking their imported content.
const { checkGeneratedAdapters, checkGeneratedDoveAgentSurfaces, generatedWriteSummary, writeGeneratedAdapters, writeGeneratedDoveAgentSurfaces } = await import("./generate-command-adapters.mjs");

if (check) {
  const drift = [...checkGeneratedAdapters(), ...checkGeneratedDoveAgentSurfaces()];
  if (drift.length > 0) {
    for (const item of drift) {
      console.error(`${item.relativePath}: ${item.reason}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Generated command adapters are up to date.");
  }
} else {
  const transaction = writeGeneratedAdapters();
  const agents = writeGeneratedDoveAgentSurfaces();
  const summary = generatedWriteSummary(contentTransaction, transaction, agents);
  console.log(JSON.stringify(summary, null, 2));
}
