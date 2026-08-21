#!/usr/bin/env node

import process from "node:process";

import { checkGeneratedAdapters, checkGeneratedDoveAgentSurfaces, generatedWriteSummary, writeGeneratedAdapters, writeGeneratedDoveAgentSurfaces } from "./generate-command-adapters.mjs";

if (process.argv.includes("--check")) {
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
  const summary = generatedWriteSummary(transaction, agents);
  console.log(JSON.stringify(summary, null, 2));
}
