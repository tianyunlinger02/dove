import { spawn } from "node:child_process";

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function matches(output, pattern) {
  if (typeof pattern === "string") return output.includes(pattern);
  pattern.lastIndex = 0;
  return pattern.test(output);
}

export function runInteractiveCommand(options) {
  const {
    command,
    args = [],
    cwd,
    env = process.env,
    steps = [],
    timeout = 15000
  } = options;
  const commandLine = [command, ...args].map(shellQuote).join(" ");

  return new Promise((resolve, reject) => {
    const child = spawn("script", ["-qefc", commandLine, "/dev/null"], {
      cwd,
      env,
      detached: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stdout = "";
    let stderr = "";
    let nextStep = 0;
    let timedOut = false;
    let settled = false;

    function signalProcessGroup(signal) {
      if (child.pid === undefined) return;
      try {
        process.kill(-child.pid, signal);
      } catch (error) {
        if (error?.code !== "ESRCH") throw error;
      }
    }

    function stopChild() {
      signalProcessGroup("SIGTERM");
      setTimeout(() => {
        if (!settled) signalProcessGroup("SIGKILL");
      }, 250).unref();
    }

    const timer = setTimeout(() => {
      timedOut = true;
      stopChild();
    }, timeout);

    function advance() {
      while (nextStep < steps.length && matches(stdout, steps[nextStep].when)) {
        child.stdin.write(steps[nextStep].input);
        nextStep += 1;
      }
    }

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
      advance();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", (error) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    child.once("close", (status, signal) => {
      clearTimeout(timer);
      settled = true;
      resolve({ status, signal, stdout, stderr, timedOut, completedSteps: nextStep });
    });
  });
}
