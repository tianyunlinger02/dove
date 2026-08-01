#!/usr/bin/env node

import process from "node:process";

import { checkGeneratedAdapters, checkGeneratedPrimaryRoles, generatedWriteSummary, writeGeneratedAdapters, writeGeneratedPrimaryRoles } from "./generate-command-adapters.mjs";

if (process.argv.includes("--check")) {
  const drift = [...checkGeneratedAdapters(), ...checkGeneratedPrimaryRoles()];
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
  const roles = writeGeneratedPrimaryRoles();
  const summary = generatedWriteSummary(transaction, roles);
  console.log(JSON.stringify(summary, null, 2));
  if (summary.transactionState !== "committed") process.exitCode = 1;
}
