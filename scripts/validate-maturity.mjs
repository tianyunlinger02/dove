import { spawnSync } from "node:child_process";

const steps = [
  ["npm", ["run", "commands:validate"]],
  ["npm", ["run", "mcp:validate"]],
  ["npm", ["run", "workflow-goals:validate"]],
  ["npm", ["run", "governance:audit"]],
  ["npm", ["test"]],
  ["npm", ["run", "doctor:validate"]]
];

for (const [command, args] of steps) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log("Maturity audit passed.");
