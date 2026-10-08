import fs from "node:fs";
import path from "node:path";

import { importProjectRoots, syncRegisteredProjects } from "../core/project-cascade.mjs";
import { parsePaperImpacts } from "../core/dashboard-data.mjs";
import { readTopicCriteriaInfo, readTopics, startTopicSelection, writeTopicCriteria } from "../core/topic-selection.mjs";
import { changeRegisteredProjects, readRegisteredProjects } from "../core/project-registry.mjs";
import {
  draftWatchConfigWithSources,
  localDate,
  readLatestScan,
  readWatchHot,
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
        topicCriteria: readTopicCriteriaInfo(options),
        passwordSet,
        canChangePassword: Boolean(passwordFile)
      };
    },
    readWatch({ root }) {
      return { config: readWatchConfig(root), digests: readWatchDigests(root, 3), impacts: parsePaperImpacts(root), scan: readLatestScan(root) };
    },
    readTopicsOverview() {
      return {
        criteria: readTopicCriteriaInfo(options),
        projects: registered().filter((root) => isDirectory(path.join(root, ".dove/research"))).map((root) => ({ root, name: path.basename(root), ...readTopics(root) }))
      };
    },
    startTopics({ root }) {
      return startTopicSelection(root, options);
    },
    saveTopicCriteria({ text }) {
      return writeTopicCriteria(text, options);
    },
    draftWatchConfig({ root }) {
      return draftWatchConfigWithSources(root, { proxy: readGlobalWatchSettings(options).proxy });
    },
    // Field-wide view: this week's best matches across projects, community
    // hot papers that touch any project's keywords, and each project's latest scan.
    readTrends({ now = Date.now() } = {}) {
      const weekAgo = localDate(now - 7 * 86400000);
      const roots = registered().filter((root) => isDirectory(path.join(root, ".dove/research")));
      const byId = new Map();
      const keywords = new Set();
      const scans = [];
      for (const root of roots) {
        const config = readWatchConfig(root);
        config.keywords.forEach((keyword) => keywords.add(keyword.toLowerCase()));
        const impacts = parsePaperImpacts(root);
        for (const digest of readWatchDigests(root, 7).filter((item) => item.date >= weekAgo)) {
          for (const item of digest.items) {
            const entry = byId.get(item.id) ?? { ...item, projects: [], impacts: [] };
            if (!entry.projects.includes(path.basename(root))) entry.projects.push(path.basename(root));
            if (impacts[item.id]) entry.impacts.push({ project: path.basename(root), ...impacts[item.id] });
            entry.score = Math.max(entry.score ?? 0, item.score ?? 0);
            byId.set(item.id, entry);
          }
        }
        const scan = readLatestScan(root);
        if (scan) scans.push({ project: path.basename(root), ...scan });
      }
      const hot = (readWatchHot(options).papers ?? []).filter((paper) => {
        const text = `${paper.title} ${paper.abstract}`.toLowerCase();
        return [...keywords].some((keyword) => text.includes(keyword));
      }).slice(0, 15);
      const top = [...byId.values()].sort((left, right) => (right.impacts.length - left.impacts.length) || (right.score - left.score)).slice(0, 30);
      return { since: weekAgo, top, hot, scans };
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
