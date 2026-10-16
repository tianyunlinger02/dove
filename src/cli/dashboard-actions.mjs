import fs from "node:fs";
import path from "node:path";

import { importProjectRoots, syncRegisteredProjects } from "../core/project-cascade.mjs";
import { parsePaperImpacts } from "../core/dashboard-data.mjs";
import { readHostSettings, writeHostSettings } from "../core/host-migration.mjs";
import { exportPaperBibtex, groupPaperLibrary, readPaperLibrary, renderPaperLibrary } from "../core/paper-library.mjs";
import { readTopicCriteriaInfo, readTopics, startTopicSelection, writeTopicCriteria } from "../core/topic-selection.mjs";
import { changeRegisteredProjects, readRegisteredProjects } from "../core/project-registry.mjs";
import { USER_ORIGINALS_BUDGET_MS, USER_ORIGINALS_PATH } from "../core/user-originals.mjs";
import { refreshUserOriginalsInBackground } from "./user-originals-worker.mjs";
import {
  draftWatchConfigWithSources,
  localDate,
  MIN_RELEVANCE,
  scorePaper,
  readLatestScan,
  readWatchState,
  watchConfigExists,
  watchConfigGuidance,
  watchScanDue,
  readWatchHot,
  readGlobalWatchSettings,
  readGlobalWatchState,
  readSemanticScholarKey,
  readWatchConfig,
  readWatchDigests,
  runWatch,
  syncPaperLibrary,
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

// A successful mentor refresh also satisfies today's prewarm. The derived
// summary's atomic replacement time survives dashboard restarts without a
// second schedule store or reading the potentially large transcript index.
function originalsRefreshedToday(root, today) {
  try {
    const stat = fs.statSync(path.join(root, USER_ORIGINALS_PATH));
    return stat.isFile() && localDate(stat.mtime) === today;
  } catch {
    return false;
  }
}

// Dashboard reads stay read-only. Explicit actions and the daily scheduler
// perform their named writes; only prewarming touches the derived originals.
export function createDashboardActions({ packageOptions = {}, passwordFile = null, run = runWatch, refreshOriginals = refreshUserOriginalsInBackground, env = process.env } = {}) {
  const options = { ...packageOptions, env };
  let running = null;
  let runError = null;
  let lastAttempt = 0;
  let prewarming = null;
  let prewarmErrors = [];
  const prewarmAttempts = new Map();
  const registered = () => readRegisteredProjects(options);
  const startPrewarm = (roots, today) => {
    if (prewarming) return;
    const due = roots.filter((root) => prewarmAttempts.get(root) !== today && !originalsRefreshedToday(root, today));
    if (!due.length) return;
    // Reserve before yielding so overlapping ticks cannot enqueue duplicates.
    // A failed project retries tomorrow (or on restart), not every ten minutes.
    for (const root of due) prewarmAttempts.set(root, today);
    prewarmErrors = [];
    prewarming = Promise.resolve().then(async () => {
      // One child at a time bounds memory and disk load across large projects.
      for (const root of due) {
        try {
          await refreshOriginals(root, { env, home: env.HOME, budgetMs: USER_ORIGINALS_BUDGET_MS });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          prewarmErrors.push({ root, error: message });
          console.error(`用户原话预热失败（${root}）：${message}`);
        }
      }
    }).finally(() => { prewarming = null; });
  };
  const startWatch = (roots, now = Date.now()) => {
    const guidance = roots.map((root) => ({ root, message: watchConfigGuidance(watchConfigExists(root) ? readWatchConfig(root) : { source: "draft" }) })).filter((item) => item.message);
    if (running) return { started: false, reason: "已有一次运行在进行", guidance };
    lastAttempt = now;
    runError = null;
    running = Promise.resolve().then(() => run(roots, options)).catch((error) => { runError = error.message; }).finally(() => { running = null; });
    return { started: true, guidance };
  };
  return {
    getSettings({ passwordSet = false } = {}) {
      const roots = registered();
      return {
        registered: roots.map((root) => ({ root, exists: isDirectory(root) })),
        projects: roots.filter((root) => isDirectory(path.join(root, ".dove/research"))).map((root) => {
          const watch = readWatchConfig(root);
          return { root, name: path.basename(root), watch, guidance: watchConfigGuidance(watch) };
        }),
        watchGlobal: readGlobalWatchSettings(options),
        hostSettings: readHostSettings(options),
        watchState: readGlobalWatchState(options),
        watchRunning: Boolean(running),
        watchError: runError,
        userOriginalsRunning: Boolean(prewarming),
        userOriginalsErrors: [...prewarmErrors],
        s2KeySet: Boolean(readSemanticScholarKey(options)),
        topicCriteria: readTopicCriteriaInfo(options),
        passwordSet,
        canChangePassword: Boolean(passwordFile)
      };
    },
    readWatch({ root, now = Date.now() }) {
      const config = readWatchConfig(root);
      const impacts = parsePaperImpacts(root);
      const scan = readLatestScan(root);
      const all = readWatchDigests(root, Infinity);
      const pending = new Map();
      for (const digest of all.slice(3)) for (const item of digest.items) if (!impacts[item.id] && !pending.has(item.id)) pending.set(item.id, item);
      return { config, guidance: watchConfigGuidance(config), state: readWatchState(root), digests: all.slice(0, 3), pending: [...pending.values()], impacts, scan, scanDue: watchScanDue(scan, now), library: groupPaperLibrary(readPaperLibrary(root).papers) };
    },
    readLibrary({ root, format = "json" }) {
      const library = readPaperLibrary(root);
      if (format === "md") return renderPaperLibrary(library.papers);
      if (format === "bib") return exportPaperBibtex(library.papers);
      return library;
    },
    syncPaperLibrary({ root }) {
      return syncPaperLibrary(root);
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
      const configs = [];
      const scans = [];
      for (const root of roots) {
        const config = readWatchConfig(root);
        if (config.enabled) configs.push(config);
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
        scans.push({ project: path.basename(root), ...(scan ?? {}), due: watchScanDue(scan, now) });
      }
      const hot = (readWatchHot(options).papers ?? []).filter((paper) => configs.some((config) => scorePaper(paper, config).relevance >= MIN_RELEVANCE)).slice(0, 15);
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
    saveHostSettings({ settings }) {
      return writeHostSettings(settings ?? {}, options);
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
        if (current.getHours() < settings.dailyHour) return;
        const today = localDate(current);
        const roots = registered().filter(isDirectory);
        startPrewarm(roots, today);
        const state = readGlobalWatchState(options);
        const latestAttempt = Math.max(lastAttempt, Date.parse(state.lastAttempt ?? "") || 0);
        if (current.getTime() - latestAttempt >= 3600000) {
          const watchRoots = roots.filter((root) => {
            if (!readWatchConfig(root).enabled) return false;
            if (state.lastRunDate === today && state.results?.some((result) => result.root === root && result.status === "unconfigured")) return false;
            const project = readWatchState(root);
            return project.status !== "done" || !project.lastRun || localDate(project.lastRun) !== today;
          });
          if (watchRoots.length) startWatch(watchRoots, current.getTime());
        }
      };
      const timer = setInterval(tick, intervalMs);
      timer.unref?.();
      tick();
      return timer;
    }
  };
}
