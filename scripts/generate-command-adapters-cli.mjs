#!/usr/bin/env node

import process from "node:process";

import { checkGeneratedAdapters, writeGeneratedAdapters } from "./generate-command-adapters.mjs";

if (process.argv.includes("--check")) {
  const drift = checkGeneratedAdapters();
  if (drift.length > 0) {
    for (const item of drift) {
      console.error(`${item.relativePath}: ${item.reason}`);
    }
    process.exitCode = 1;
  } else {
    console.log("Generated command adapters are up to date.");
  }
} else {
  const written = writeGeneratedAdapters();
  console.log(JSON.stringify({ written }, null, 2));
}
