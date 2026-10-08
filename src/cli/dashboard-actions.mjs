import fs from "node:fs";
import path from "node:path";

import { importProjectRoots, syncRegisteredProjects } from "../core/project-cascade.mjs";
import { changeRegisteredProjects, readRegisteredProjects } from "../core/project-registry.mjs";
import {
  localDate,
  readGlobalWatchSettings,
  readGlobalWatchState,
  readSemanticScholarKey,
  readWatchConfig,
  readWatchDigests,
  runWatch,
  writeGlobalWatchSettings,
  writeSemanticScholarKey,
  writeWatchConfig
} from "../core/paper-watch.mjs";

function isDirectory(root) {
  try {
    return fs.statSync(root).isDirectory();
  } catch {
    return false;
  }
}

// Everything the dashboard settings page can do. Research records are never
// written here; only Dove's own settings, registry and watch files.
export function createDashboardActions({ packageOptions = {}, passwordFile = null, run = runWatch, env = process.env } = {}) {
  const options = { ...packageOptions, env };
  let running = null;
  const registered = () => readRegisteredProjects(options);
  const startWatch = (roots) => {
    if (running) return { started: false, reason: "已有一次运行在进行" };
    running = Promise.resolve(run(roots, options)).catch(() => null).finally(() => { running = null; });
    return { started: true };
  };
  return {
    getSettings({ passwordSet = false } = {}) {
      const roots = registered();
      return {
        registered: roots.map((root) => ({ root, exists: isDirectory(root) })),
        projects: roots.filter((root) => isDirectory(path.join(root, ".dove/research"))).map((root) => ({ root, name: path.basename(root), watch: readWatchConfig(root) })),
        watchGlobal: readGlobalWatchSettings(options),
        watchState: readGlobalWatchState(options),
        watchRunning: Boolean(running),
        s2KeySet: Boolean(readSemanticScholarKey(options)),
        passwordSet,
        canChangePassword: Boolean(passwordFile)
      };
    },
    readWatch({ root }) {
      return { config: readWatchConfig(root), digests: readWatchDigests(root, 3) };
    },
    addProject({ path: target }) {
      if (typeof target !== "string" || !path.isAbsolute(target)) throw new Error("请填写项目的绝对路径");
      return importProjectRoots([path.normalize(target)], options);
    },
    removeProject({ root }) {
      return changeRegisteredProjects([], [root], options);
    },
    syncProjects() {
      return syncRegisteredProjects(options).projects;
    },
    saveWatchConfig({ root, config }) {
      return writeWatchConfig(root, config ?? {});
    },
    saveWatchGlobal({ settings }) {
      return writeGlobalWatchSettings(settings ?? {}, options);
    },
    saveS2Key({ key }) {
      return { set: writeSemanticScholarKey(key, options) };
    },
    runWatch({ root } = {}) {
      const roots = root ? [root] : registered().filter(isDirectory);
      return startWatch(roots);
    },
    changePassword(next) {
      if (!passwordFile) throw new Error("面板没有用 --password-file 启动，不能在这里改密码");
      const temporary = `${passwordFile}.${process.pid}.tmp`;
      fs.writeFileSync(temporary, next, { mode: 0o600 });
      fs.renameSync(temporary, passwordFile);
    },
    // Runs once a day at the configured hour while the dashboard is up.
    startScheduler({ intervalMs = 10 * 60 * 1000, now = () => new Date() } = {}) {
      const tick = () => {
        const settings = readGlobalWatchSettings(options);
        const current = now();
        const today = localDate(current);
        if (current.getHours() >= settings.dailyHour && readGlobalWatchState(options).lastRunDate !== today) startWatch(registered().filter(isDirectory));
      };
      const timer = setInterval(tick, intervalMs);
      timer.unref?.();
      tick();
      return timer;
    }
  };
}
