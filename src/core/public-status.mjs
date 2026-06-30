import fs from "node:fs";
import path from "node:path";

import {
  ARTIFACT_PATHS,
  createDocumentLedgerIndex,
  createRuntimeEventsIndex,
  createRuntimeResultsIndex,
  createTaskPacketsIndex,
  normalizeDocumentLedgerIndex
} from "./schema.mjs";
import { loadDoveConfig, normalizeGlobalStatusProjects, resolveDoveGlobalStatusOutputDir } from "./config.mjs";
import { queryDoveStatus } from "./dove.mjs";
import { isPatchPlanMode } from "./mutation-backend.mjs";
import { assertGovernanceMutationRegistered, ensureWorkspace, nowIso, readJson, writeJson, writeText } from "./workspace.mjs";

const PUBLIC_STATUS_VERSION = 1;
const GLOBAL_PUBLIC_STATUS_VERSION = 1;
const PUBLIC_TASK_LIMIT = 12;
const PUBLIC_RECENT_LIMIT = 8;
const SECRET_PATTERNS = [
  { pattern: /sk-ant-[A-Za-z0-9_-]+/g, replacement: "<redacted>" },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, replacement: "Bearer <redacted>" },
  { pattern: /\b(api[_-]?key|auth[_-]?token|access[_-]?token|secret|password|passwd|pwd)\s*[:=]\s*[^\s,;"']+/gi, replacement: (match, label) => `${label}=<redacted>` }
];

function redactText(value) {
  let text = String(value ?? "");
  for (const item of SECRET_PATTERNS) {
    text = text.replace(item.pattern, item.replacement);
  }
  return text;
}

function publicString(value, maxLength = 320) {
  const text = redactText(value).replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function publicStringArray(value, limit = 10, maxLength = 220) {
  const values = Array.isArray(value) ? value : (typeof value === "string" ? [value] : []);
  return Array.from(new Set(values.map((item) => publicString(item, maxLength)).filter(Boolean))).slice(0, limit);
}

function firstPublicString(...values) {
  for (const value of values) {
    const normalized = publicString(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function publicTask(task) {
  if (!task || typeof task !== "object") {
    return null;
  }
  return {
    id: publicString(task.id, 160),
    title: publicString(task.title, 220) ?? publicString(task.id, 160),
    summary: firstPublicString(task.summary, task.currentFocus, task.lastStopReason),
    status: publicString(task.status, 80),
    stage: publicString(task.stage, 80),
    domain: publicString(task.domain, 80),
    level: Number.isFinite(Number(task.level)) ? Number(task.level) : null,
    creatorKind: publicString(task.creatorKind, 80),
    currentFocus: publicString(task.currentFocus),
    nextAction: publicString(task.nextAction, 160),
    blockedReason: publicString(task.blockedReason ?? task.lastStopReason),
    boundary: task.actionableBoundary ? {
      id: publicString(task.actionableBoundary.id, 160),
      type: publicString(task.actionableBoundary.type, 120),
      reason: publicString(task.actionableBoundary.reason ?? task.actionableBoundary.summary),
      requiredInputs: publicStringArray(task.actionableBoundary.requiredInputs),
      requiredActions: publicStringArray(task.actionableBoundary.requiredActions),
      ownerRole: publicString(task.actionableBoundary.ownerRole, 80),
      nextRole: publicString(task.actionableBoundary.nextRole, 80)
    } : null,
    evidenceExpectations: publicStringArray(task.evidenceExpectations),
    evidenceLinks: publicStringArray(task.evidenceLinks, 8),
    artifactRefs: publicStringArray(task.artifactRefs, 8),
    updatedAt: publicString(task.updatedAt, 80),
    completedAt: publicString(task.completedAt, 80)
  };
}

function publicAction(action) {
  if (!action || typeof action !== "object") {
    return null;
  }
  return {
    rank: Number.isFinite(Number(action.rank)) ? Number(action.rank) : null,
    title: publicString(action.title ?? action.label, 220),
    why: publicString(action.why ?? action.reason ?? action.summary),
    command: publicString(action.command, 160),
    packetId: publicString(action.packetId, 160),
    boundaryType: publicString(action.boundaryType, 120),
    requires: publicStringArray(action.requires ?? [...publicStringArray(action.requiredInputs), ...publicStringArray(action.requiredActions)])
  };
}

function publicReview(review) {
  const reviewerIndependence = review?.reviewerIndependence;
  const reviewerIndependenceSummary = reviewerIndependence && typeof reviewerIndependence === "object"
    ? firstPublicString(reviewerIndependence.summary, reviewerIndependence.status, reviewerIndependence.reviewerRole)
    : publicString(reviewerIndependence, 160);
  return {
    verdict: publicString(review?.verdict, 80) ?? "not-reviewed",
    reviewedAt: publicString(review?.reviewedAt, 80),
    unresolvedConcernCount: Number(review?.unresolvedConcernCount ?? 0),
    openConcernCount: Number(review?.openConcernCount ?? 0),
    reviewerIndependence: reviewerIndependenceSummary
  };
}

function publicRuntime(status) {
  const runtime = status.dashboard?.runtime ?? {};
  return {
    continuation: {
      continuationCount: Number(runtime.continuation?.continuationCount ?? 0),
      currentKind: publicString(runtime.continuation?.currentKind, 120),
      currentPacketId: publicString(runtime.continuation?.currentPacketId, 160),
      currentCommand: publicString(runtime.continuation?.currentCommand, 160),
      overview: publicString(runtime.continuation?.overview)
    },
    results: {
      runCount: Number(runtime.results?.runCount ?? 0),
      completedCount: Number(runtime.results?.completedCount ?? 0),
      errorCount: Number(runtime.results?.errorCount ?? 0),
      lastRunId: publicString(runtime.results?.lastRunId, 160),
      lastStatus: publicString(runtime.results?.lastStatus, 120),
      lastOutcome: publicString(runtime.results?.lastOutcome, 160),
      overview: publicString(runtime.results?.overview)
    },
    events: {
      eventCount: Number(runtime.events?.eventCount ?? 0),
      lastEventType: publicString(runtime.events?.lastEventType, 120),
      lastRunId: publicString(runtime.events?.lastRunId, 160),
      overview: publicString(runtime.events?.overview)
    }
  };
}

function publicTaskSection(tasks, limit) {
  return (Array.isArray(tasks) ? tasks : []).map(publicTask).filter(Boolean).slice(0, limit);
}

function publicDocumentEntry(entry) {
  if (!entry || typeof entry !== "object" || entry.publicSafe !== true) {
    return null;
  }
  return {
    id: publicString(entry.id, 160),
    packetId: publicString(entry.packetId, 160),
    documentId: publicString(entry.documentId, 160),
    title: publicString(entry.title, 220) ?? publicString(entry.documentId, 160),
    documentKind: publicString(entry.documentKind, 80),
    status: publicString(entry.status, 80),
    evidenceScope: publicString(entry.evidenceScope, 80),
    summary: publicString(entry.summary),
    artifactRefs: publicStringArray(entry.artifactRefs, 6),
    evidenceLinks: publicStringArray(entry.evidenceLinks, 6),
    updatedAt: publicString(entry.updatedAt, 80)
  };
}

function publicDocuments(root) {
  const ledger = normalizeDocumentLedgerIndex(readJson(root, ARTIFACT_PATHS.documentsLedger, createDocumentLedgerIndex));
  const publicSafeLedgerEntries = ledger.entries.filter((entry) => entry.publicSafe === true);
  const publicSafeEntries = publicSafeLedgerEntries.map(publicDocumentEntry).filter(Boolean).slice(-PUBLIC_RECENT_LIMIT);
  return {
    counts: {
      total: publicSafeLedgerEntries.length,
      internalEvidence: publicSafeLedgerEntries.filter((entry) => entry.evidenceScope === "internal").length,
      externalEvidence: publicSafeLedgerEntries.filter((entry) => entry.evidenceScope === "external").length,
      mixedEvidence: publicSafeLedgerEntries.filter((entry) => entry.evidenceScope === "mixed").length,
      publicSafe: publicSafeLedgerEntries.length
    },
    recentPublicSafe: publicSafeEntries,
    ledgerPath: ARTIFACT_PATHS.documentsLedger
  };
}

function countRuntimeEntries(root) {
  const results = readJson(root, ARTIFACT_PATHS.runtimeResults, createRuntimeResultsIndex);
  const events = readJson(root, ARTIFACT_PATHS.runtimeEvents, createRuntimeEventsIndex);
  const taskPackets = readJson(root, ARTIFACT_PATHS.taskPacketsIndex, createTaskPacketsIndex);
  return {
    taskPacketIndexItems: Array.isArray(taskPackets.items) ? taskPackets.items.length : 0,
    runtimeResultEntries: Array.isArray(results.entries) ? results.entries.length : 0,
    runtimeEventEntries: Array.isArray(events.entries) ? events.entries.length : 0
  };
}

function markdownList(items, formatter) {
  if (!Array.isArray(items) || items.length === 0) {
    return "- 暂无\n";
  }
  return items.map(formatter).join("\n") + "\n";
}

function renderMarkdown(snapshot) {
  const activeTasks = markdownList(snapshot.tasks.active, (task) => `- ${task.title} \`${task.id}\` — ${task.status}${task.nextAction ? `；下一步：${task.nextAction}` : ""}`);
  const blockedTasks = markdownList(snapshot.tasks.blocked, (task) => `- ${task.title} \`${task.id}\` — ${task.blockedReason ?? task.boundary?.reason ?? "已阻塞"}`);
  const recentCompleted = markdownList(snapshot.tasks.recentCompleted, (task) => `- ${task.title} \`${task.id}\`${task.completedAt ? ` — ${task.completedAt}` : ""}`);
  const actions = markdownList(snapshot.nextActions, (action) => `- ${action.title ?? action.command} ${action.command ? `\`${action.command}\`` : ""}${action.why ? ` — ${action.why}` : ""}`);
  const documents = markdownList(snapshot.documents.recentPublicSafe, (entry) => `- ${entry.title} \`${entry.documentId ?? entry.id}\` — ${entry.documentKind}/${entry.status}/${entry.evidenceScope}${entry.summary ? `；${entry.summary}` : ""}`);
  return `# Dove 项目进展\n\n> 自动生成：${snapshot.generatedAt}\n> 来源：Dove durable state 的公开安全摘要；不包含 raw transcripts、私密推理、环境变量或完整 .dove dump。\n\n## 目标\n\n- 项目：${snapshot.project.title ?? "未设置"}\n- 目标：${snapshot.project.objective ?? "未设置"}\n- 当前焦点：${snapshot.project.currentFocus ?? "暂无"}\n- 下一步：${snapshot.project.nextAction ?? "project:dove.status"}\n\n## 进展概览\n\n- 活跃任务：${snapshot.progress.counts.active}\n- 阻塞任务：${snapshot.progress.counts.blocked}\n- 已完成任务：${snapshot.progress.counts.completed}\n- 已杀死任务：${snapshot.progress.counts.killed}\n- Review verdict：${snapshot.progress.review.verdict}\n- Runtime：${snapshot.progress.runtime.results.lastStatus ?? "never-run"}/${snapshot.progress.runtime.results.lastOutcome ?? "not-started"}\n- 公开安全文档/证据：${snapshot.documents.counts.publicSafe}/${snapshot.documents.counts.total}\n\n## 当前活跃任务\n\n${activeTasks}\n## 阻塞 / 边界\n\n${blockedTasks}\n## 最近完成\n\n${recentCompleted}\n## 建议下一步\n\n${actions}\n## 公开文档 / 证据摘要\n\n${documents}\n## 公开边界\n\n- 仅公开派生摘要，不公开 raw runtime entries、raw document ledger entries 或文档正文。\n- 不公开 Claude/host transcript、隐藏推理、环境变量、token、密码或完整 .dove 内容。\n- 若要外网访问，建议只暴露 \`.dove/public\`，并在 Cloudflare/反代层加访问控制。\n`;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[char]));
}

function htmlTaskList(tasks) {
  if (!tasks.length) {
    return "<li>暂无</li>";
  }
  return tasks.map((task) => `<li><strong>${escapeHtml(task.title)}</strong> <code>${escapeHtml(task.id)}</code><br><span>${escapeHtml(task.status)}${task.nextAction ? ` · 下一步：${escapeHtml(task.nextAction)}` : ""}</span>${task.summary ? `<p>${escapeHtml(task.summary)}</p>` : ""}</li>`).join("\n");
}

function htmlActionList(actions) {
  if (!actions.length) {
    return "<li>暂无</li>";
  }
  return actions.map((action) => `<li><strong>${escapeHtml(action.title ?? action.command)}</strong>${action.command ? ` <code>${escapeHtml(action.command)}</code>` : ""}${action.why ? `<p>${escapeHtml(action.why)}</p>` : ""}</li>`).join("\n");
}

function htmlDocumentList(documents) {
  if (!documents.length) {
    return "<li>暂无</li>";
  }
  return documents.map((entry) => `<li><strong>${escapeHtml(entry.title)}</strong> <code>${escapeHtml(entry.documentId ?? entry.id)}</code><br><span>${escapeHtml(entry.documentKind)}/${escapeHtml(entry.status)} · ${escapeHtml(entry.evidenceScope)}</span>${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}</li>`).join("\n");
}

function renderHtml(snapshot) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(snapshot.project.title ?? "Dove 项目进展")}</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #0f172a; color: #e2e8f0; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px 56px; }
    a { color: #93c5fd; }
    .hero, section { background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 18px; padding: 20px; margin: 16px 0; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28); }
    h1, h2 { margin: 0 0 12px; }
    .meta, .muted { color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .metric { background: rgba(30, 41, 59, 0.72); border-radius: 14px; padding: 14px; }
    .metric strong { display: block; font-size: 1.8rem; }
    li { margin: 0 0 12px; }
    code { background: rgba(148, 163, 184, 0.18); border-radius: 6px; padding: 2px 6px; }
  </style>
</head>
<body>
<main>
  <div class="hero">
    <p class="meta">Dove public status · ${escapeHtml(snapshot.generatedAt)}</p>
    <h1>${escapeHtml(snapshot.project.title ?? "Dove 项目进展")}</h1>
    <p>${escapeHtml(snapshot.project.objective ?? "未设置项目目标")}</p>
    <p><strong>当前焦点：</strong>${escapeHtml(snapshot.project.currentFocus ?? "暂无")}</p>
    <p><strong>下一步：</strong><code>${escapeHtml(snapshot.project.nextAction ?? "project:dove.status")}</code></p>
    <p><a href="status.json">status.json</a> · <a href="status.md">status.md</a></p>
  </div>

  <section>
    <h2>进展概览</h2>
    <div class="grid">
      <div class="metric"><strong>${snapshot.progress.counts.active}</strong><span>活跃</span></div>
      <div class="metric"><strong>${snapshot.progress.counts.blocked}</strong><span>阻塞</span></div>
      <div class="metric"><strong>${snapshot.progress.counts.completed}</strong><span>完成</span></div>
      <div class="metric"><strong>${snapshot.progress.counts.killed}</strong><span>杀死</span></div>
      <div class="metric"><strong>${snapshot.documents.counts.publicSafe}/${snapshot.documents.counts.total}</strong><span>公开文档/证据</span></div>
    </div>
    <p class="muted">Review: ${escapeHtml(snapshot.progress.review.verdict)} · Runtime: ${escapeHtml(snapshot.progress.runtime.results.lastStatus ?? "never-run")}/${escapeHtml(snapshot.progress.runtime.results.lastOutcome ?? "not-started")}</p>
  </section>

  <section><h2>当前活跃任务</h2><ul>${htmlTaskList(snapshot.tasks.active)}</ul></section>
  <section><h2>阻塞 / 边界</h2><ul>${htmlTaskList(snapshot.tasks.blocked)}</ul></section>
  <section><h2>最近完成</h2><ul>${htmlTaskList(snapshot.tasks.recentCompleted)}</ul></section>
  <section><h2>建议下一步</h2><ul>${htmlActionList(snapshot.nextActions)}</ul></section>
  <section><h2>公开文档 / 证据摘要</h2><ul>${htmlDocumentList(snapshot.documents.recentPublicSafe)}</ul></section>
  <section><h2>公开边界</h2><p class="muted">此页面只发布 Dove durable state 的脱敏摘要，不发布 raw transcripts、raw document ledger entries、文档正文、私密推理、环境变量、token、密码或完整 .dove 内容。外网访问时建议只暴露 <code>.dove/public</code> 并启用访问控制。</p></section>
</main>
</body>
</html>
`;
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function arrayValue(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value === undefined || value === null ? [] : [value];
}

function slugify(value, fallback) {
  const raw = publicString(value, 160) ?? fallback;
  const slug = String(raw ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function dedupeProjects(projects) {
  const byRoot = new Map();
  for (const project of projects) {
    byRoot.set(project.root, project);
  }
  return Array.from(byRoot.values());
}

function withCollisionSafeSlugs(projects) {
  const used = new Map();
  return projects.map((project, index) => {
    const base = slugify(project.slug ?? project.id ?? project.title ?? path.basename(project.root), `project-${index + 1}`);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    const slug = count === 0 ? base : `${base}-${count + 1}`;
    return {
      ...project,
      id: project.id ?? slug,
      slug,
      title: project.title ?? path.basename(project.root)
    };
  });
}

function resolveGlobalStatusSelection(root, options = {}) {
  const env = options.env ?? process.env;
  const config = loadDoveConfig(root, env);
  const explicitProjects = normalizeGlobalStatusProjects([
    ...arrayValue(options.projects),
    ...arrayValue(options.projectRoots).map((projectRoot) => ({ root: projectRoot })),
    ...arrayValue(options.projectRoot).map((projectRoot) => ({ root: projectRoot }))
  ]);
  const configuredProjects = config.globalStatus.projects;
  const selected = explicitProjects.length > 0
    ? (options.includeConfig ? [...configuredProjects, ...explicitProjects] : explicitProjects)
    : configuredProjects;
  return {
    env,
    config,
    outputDir: resolveDoveGlobalStatusOutputDir(options.outputDir ?? config.globalStatus.outputDir, env),
    projects: withCollisionSafeSlugs(dedupeProjects(selected))
  };
}

function readProjectPublicStatus(project) {
  const jsonPath = path.join(project.root, ARTIFACT_PATHS.publicStatusJson);
  if (!fs.existsSync(jsonPath)) {
    return { status: "missing", project, snapshot: null, reason: `${ARTIFACT_PATHS.publicStatusJson} is missing` };
  }
  try {
    const snapshot = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    if (!isPlainObject(snapshot) || snapshot.mode !== "dove-public-status") {
      return { status: "invalid", project, snapshot: null, reason: "status.json is not a Dove public status snapshot" };
    }
    return { status: "published", project, snapshot, reason: null };
  } catch {
    return { status: "invalid", project, snapshot: null, reason: "status.json could not be parsed" };
  }
}

function projectLinks(slug) {
  return {
    html: `projects/${slug}/index.html`,
    json: `projects/${slug}/status.json`,
    markdown: `projects/${slug}/status.md`
  };
}

function publicProjectCard(readResult) {
  const { project, snapshot, status, reason } = readResult;
  const title = publicString(project.title ?? snapshot?.project?.title, 220) ?? project.slug;
  return {
    id: publicString(project.id, 160) ?? project.slug,
    slug: project.slug,
    title,
    status,
    generatedAt: publicString(snapshot?.generatedAt, 80),
    summary: status === "published"
      ? firstPublicString(snapshot?.project?.currentFocus, snapshot?.project?.objective, snapshot?.project?.nextAction)
      : publicString(reason, 220),
    project: status === "published" ? {
      title: publicString(snapshot?.project?.title, 220),
      objective: publicString(snapshot?.project?.objective),
      currentFocus: publicString(snapshot?.project?.currentFocus),
      nextAction: publicString(snapshot?.project?.nextAction, 160)
    } : null,
    progress: status === "published" ? {
      counts: snapshot?.progress?.counts ?? {},
      review: publicReview(snapshot?.progress?.review),
      runtime: snapshot?.progress?.runtime ?? {}
    } : null,
    documents: status === "published" ? snapshot?.documents ?? null : null,
    links: projectLinks(project.slug)
  };
}

function buildGlobalStatusSnapshotFromReadResults(readResults, generatedAt) {
  const projectCards = readResults.map(publicProjectCard);
  const counts = {
    configured: readResults.length,
    published: projectCards.filter((project) => project.status === "published").length,
    missing: projectCards.filter((project) => project.status === "missing").length,
    invalid: projectCards.filter((project) => project.status === "invalid").length,
    skipped: projectCards.filter((project) => project.status === "skipped").length
  };
  return {
    version: GLOBAL_PUBLIC_STATUS_VERSION,
    mode: "dove-global-public-status",
    generatedAt,
    counts,
    projects: projectCards,
    publicArtifacts: {
      json: "status.json",
      markdown: "status.md",
      html: "index.html",
      projectsDir: "projects"
    },
    privacy: {
      sanitized: true,
      derivedOnly: true,
      rawDoveDumpIncluded: false,
      absoluteRootsIncluded: false,
      transcriptsIncluded: false,
      privateReasoningIncluded: false,
      environmentIncluded: false,
      runtimeEntriesIncluded: false,
      documentLedgerRawEntriesIncluded: false,
      documentBodiesIncluded: false,
      cloudflareTunnelStarted: false
    }
  };
}

function buildGlobalStatusSnapshot(root, options = {}) {
  const { projects } = resolveGlobalStatusSelection(root, options);
  return buildGlobalStatusSnapshotFromReadResults(projects.map(readProjectPublicStatus), options.generatedAt ?? nowIso());
}

function renderGlobalMarkdown(snapshot) {
  const projects = markdownList(snapshot.projects, (project) => {
    const counts = project.progress?.counts ?? {};
    const active = Number(counts.active ?? 0);
    const blocked = Number(counts.blocked ?? 0);
    const completed = Number(counts.completed ?? 0);
    return `- [${project.title}](${project.links.html}) — ${project.status}；活跃 ${active} / 阻塞 ${blocked} / 完成 ${completed}${project.summary ? `；${project.summary}` : ""}`;
  });
  return `# Dove 全局项目进展

> 自动生成：${snapshot.generatedAt}
> 来源：各项目 \`.dove/public\` 的公开安全摘要；不包含本机绝对路径、raw .dove dump、transcript、私密推理、环境变量或文档正文。

## 概览

- 已配置项目：${snapshot.counts.configured}
- 已发布项目：${snapshot.counts.published}
- 缺失 public status：${snapshot.counts.missing}
- 无效 public status：${snapshot.counts.invalid}

## 项目

${projects}
## 公开边界

- 这个全局页面只聚合每个项目已经公开安全的 \`.dove/public/status.*\`。
- 不扫描整台电脑，不启动 HTTP server 或 Cloudflare tunnel。
- 若要外网访问，建议只暴露这个全局 public 目录，并在 Cloudflare/反代层加访问控制。
`;
}

function htmlProjectCards(projects) {
  if (!projects.length) {
    return "<li>暂无已配置项目</li>";
  }
  return projects.map((project) => {
    const counts = project.progress?.counts ?? {};
    return `<li><strong><a href="${escapeHtml(project.links.html)}">${escapeHtml(project.title)}</a></strong> <code>${escapeHtml(project.status)}</code><br><span>活跃 ${escapeHtml(counts.active ?? 0)} · 阻塞 ${escapeHtml(counts.blocked ?? 0)} · 完成 ${escapeHtml(counts.completed ?? 0)}</span>${project.summary ? `<p>${escapeHtml(project.summary)}</p>` : ""}</li>`;
  }).join("\n");
}

function renderGlobalHtml(snapshot) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Dove 全局项目进展</title>
  <style>
    :root { color-scheme: light dark; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #0f172a; color: #e2e8f0; }
    main { max-width: 980px; margin: 0 auto; padding: 32px 20px 56px; }
    a { color: #93c5fd; }
    .hero, section { background: rgba(15, 23, 42, 0.82); border: 1px solid rgba(148, 163, 184, 0.28); border-radius: 18px; padding: 20px; margin: 16px 0; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.28); }
    h1, h2 { margin: 0 0 12px; }
    .meta, .muted { color: #94a3b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
    .metric { background: rgba(30, 41, 59, 0.72); border-radius: 14px; padding: 14px; }
    .metric strong { display: block; font-size: 1.8rem; }
    li { margin: 0 0 14px; }
    code { background: rgba(148, 163, 184, 0.18); border-radius: 6px; padding: 2px 6px; }
  </style>
</head>
<body>
<main>
  <div class="hero">
    <p class="meta">Dove global public status · ${escapeHtml(snapshot.generatedAt)}</p>
    <h1>Dove 全局项目进展</h1>
    <p>聚合所有显式注册项目的公开安全状态页。</p>
    <p><a href="status.json">status.json</a> · <a href="status.md">status.md</a></p>
  </div>
  <section>
    <h2>概览</h2>
    <div class="grid">
      <div class="metric"><strong>${snapshot.counts.configured}</strong><span>已配置</span></div>
      <div class="metric"><strong>${snapshot.counts.published}</strong><span>已发布</span></div>
      <div class="metric"><strong>${snapshot.counts.missing}</strong><span>缺失</span></div>
      <div class="metric"><strong>${snapshot.counts.invalid}</strong><span>无效</span></div>
    </div>
  </section>
  <section><h2>项目</h2><ul>${htmlProjectCards(snapshot.projects)}</ul></section>
  <section><h2>公开边界</h2><p class="muted">此页面只聚合各项目已发布的公开安全摘要，不包含本机绝对路径、raw .dove dump、transcript、私密推理、环境变量、token、密码或文档正文。Dove 不会自动启动 HTTP server 或 Cloudflare tunnel。</p></section>
</main>
</body>
</html>
`;
}

function projectPlaceholderMarkdown(project, status, reason) {
  const title = publicString(project.title, 220) ?? project.slug;
  return `# ${title}

- 状态：${status}
- 原因：${publicString(reason, 220) ?? "项目 public status 不可用"}
`;
}

function projectPlaceholderHtml(project, status, reason) {
  const title = publicString(project.title, 220) ?? project.slug;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head><body><main><h1>${escapeHtml(title)}</h1><p>状态：${escapeHtml(status)}</p><p>${escapeHtml(publicString(reason, 220) ?? "项目 public status 不可用")}</p><p><a href="../../index.html">返回全局首页</a></p></main></body></html>
`;
}

function ensureAbsoluteDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeAbsoluteJson(filePath, value) {
  ensureAbsoluteDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeAbsoluteText(filePath, value) {
  ensureAbsoluteDir(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

function projectRelativeOutputPath(root, filePath) {
  const relativePath = path.relative(path.resolve(root), path.resolve(filePath));
  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    return null;
  }
  return relativePath.split(path.sep).join("/");
}

function writeOutputJson(root, filePath, value) {
  const relativePath = projectRelativeOutputPath(root, filePath);
  if (relativePath) {
    writeJson(root, relativePath, value);
    return;
  }
  if (isPatchPlanMode(root)) {
    throw new Error("publish_dove_global_status patch-plan requires outputDir to stay inside the target project.");
  }
  writeAbsoluteJson(filePath, value);
}

function writeOutputText(root, filePath, value) {
  const relativePath = projectRelativeOutputPath(root, filePath);
  if (relativePath) {
    writeText(root, relativePath, value);
    return;
  }
  if (isPatchPlanMode(root)) {
    throw new Error("publish_dove_global_status patch-plan requires outputDir to stay inside the target project.");
  }
  writeAbsoluteText(filePath, value);
}

function readPublicText(project, relativePath, fallback) {
  const fullPath = path.join(project.root, relativePath);
  try {
    return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : fallback;
  } catch {
    return fallback;
  }
}

function writeGlobalProjectArtifacts(root, outputDir, readResult) {
  const { project, snapshot, status, reason } = readResult;
  const projectDir = path.join(outputDir, "projects", project.slug);
  const projectSnapshot = snapshot ?? {
    version: 1,
    mode: "dove-global-project-placeholder",
    status,
    title: publicString(project.title, 220) ?? project.slug,
    generatedAt: null,
    summary: publicString(reason, 220),
    links: projectLinks(project.slug),
    privacy: {
      sanitized: true,
      derivedOnly: true,
      absoluteRootsIncluded: false
    }
  };
  const markdown = snapshot
    ? readPublicText(project, ARTIFACT_PATHS.publicStatusMarkdown, projectPlaceholderMarkdown(project, status, reason))
    : projectPlaceholderMarkdown(project, status, reason);
  const html = snapshot
    ? readPublicText(project, ARTIFACT_PATHS.publicStatusHtml, projectPlaceholderHtml(project, status, reason))
    : projectPlaceholderHtml(project, status, reason);
  writeOutputJson(root, path.join(projectDir, "status.json"), projectSnapshot);
  writeOutputText(root, path.join(projectDir, "status.md"), markdown);
  writeOutputText(root, path.join(projectDir, "index.html"), html);
  return [
    path.join(projectDir, "status.json"),
    path.join(projectDir, "status.md"),
    path.join(projectDir, "index.html")
  ].map((filePath) => path.relative(outputDir, filePath).split(path.sep).join("/"));
}

export function buildDoveGlobalPublicStatus(root, options = {}) {
  return buildGlobalStatusSnapshot(root, options);
}

function refreshGlobalProjectPublicStatus(project, options = {}) {
  try {
    if (!fs.existsSync(project.root) || !fs.statSync(project.root).isDirectory()) {
      return { status: "skipped", project, snapshot: null, reason: "project root is missing" };
    }
    publishDoveStatus(project.root, {
      includeArchived: Boolean(options.includeArchived),
      responseLanguage: options.responseLanguage,
      generatedAt: options.generatedAt
    });
    return null;
  } catch {
    return { status: "skipped", project, snapshot: null, reason: "project public status refresh failed" };
  }
}

export function publishDoveGlobalStatus(root, options = {}) {
  assertGovernanceMutationRegistered("publish-dove-global-status", "exempt");
  if (options.refresh && isPatchPlanMode(root)) {
    throw new Error("publish_dove_global_status patch-plan does not support refresh; publish each project status with patch-plan before aggregating.");
  }
  const selection = resolveGlobalStatusSelection(root, options);
  const refreshResults = [];
  const readResults = selection.projects.map((project) => {
    const refreshFailure = options.refresh ? refreshGlobalProjectPublicStatus(project, options) : null;
    if (refreshFailure) {
      refreshResults.push({ slug: project.slug, title: publicString(project.title, 220), status: refreshFailure.status, reason: refreshFailure.reason });
      return refreshFailure;
    }
    if (options.refresh) {
      refreshResults.push({ slug: project.slug, title: publicString(project.title, 220), status: "refreshed" });
    }
    return readProjectPublicStatus(project);
  });
  const snapshot = buildGlobalStatusSnapshotFromReadResults(readResults, options.generatedAt ?? nowIso());
  const markdown = renderGlobalMarkdown(snapshot);
  const html = renderGlobalHtml(snapshot);
  const writes = [];
  writeOutputJson(root, path.join(selection.outputDir, "status.json"), snapshot);
  writes.push("status.json");
  writeOutputText(root, path.join(selection.outputDir, "status.md"), markdown);
  writes.push("status.md");
  writeOutputText(root, path.join(selection.outputDir, "index.html"), html);
  writes.push("index.html");
  for (const readResult of readResults) {
    writes.push(...writeGlobalProjectArtifacts(root, selection.outputDir, readResult));
  }
  return {
    mode: "dove-global-public-status-publish",
    status: "published",
    generatedAt: snapshot.generatedAt,
    outputDir: selection.outputDir,
    projectCount: selection.projects.length,
    refresh: Boolean(options.refresh),
    refreshResults,
    writes,
    publicArtifacts: snapshot.publicArtifacts,
    snapshot,
    privacy: snapshot.privacy,
    noDaemon: true,
    noScheduler: true,
    noExternalProcess: true,
    cloudflareTunnelStarted: false
  };
}

export function buildDovePublicStatus(root, options = {}) {
  ensureWorkspace(root);
  const status = queryDoveStatus(root, {
    includeArchived: Boolean(options.includeArchived),
    responseLanguage: options.responseLanguage,
    detail: "full"
  });
  const tasks = status.dashboard?.tasks ?? {};
  const project = status.dashboard?.project ?? {};
  const generatedAt = options.generatedAt ?? nowIso();
  return {
    version: PUBLIC_STATUS_VERSION,
    mode: "dove-public-status",
    generatedAt,
    responseLanguage: status.responseLanguage,
    project: {
      title: publicString(project.title ?? status.projectSummary?.title),
      objective: publicString(project.objective ?? status.projectSummary?.objective),
      currentFocus: publicString(project.currentFocus ?? status.projectSummary?.focus),
      nextAction: publicString(project.nextAction ?? status.suggestedNextCommand, 160),
      durableRoot: ARTIFACT_PATHS.doveRoot
    },
    requirements: {
      evidenceExpectations: publicStringArray(status.dashboard?.init?.evidenceExpectations),
      acceptanceSource: "durable-task-packets"
    },
    documents: publicDocuments(root),
    progress: {
      returnStatus: publicString(status.dashboard?.returnReadiness?.status, 80),
      counts: {
        total: Number(tasks.counts?.total ?? 0),
        active: Number(tasks.counts?.active ?? 0),
        blocked: Number(tasks.counts?.blocked ?? 0),
        completed: Number(tasks.counts?.completed ?? 0),
        killed: Number(tasks.counts?.killed ?? 0),
        byStatus: tasks.counts?.byStatus ?? {}
      },
      review: publicReview(status.dashboard?.review),
      lessons: {
        activeLessonCount: Number(status.dashboard?.lessons?.activeLessonCount ?? 0),
        mustObeyLessonCount: Number(status.dashboard?.lessons?.mustObeyLessonCount ?? 0),
        lessonsPath: publicString(status.dashboard?.lessons?.lessonsPath, 220)
      },
      versions: status.dashboard?.versions ?? {},
      experiments: status.dashboard?.experiments ?? {},
      runtime: publicRuntime(status)
    },
    tasks: {
      init: publicTask(status.dashboard?.init),
      active: publicTaskSection(tasks.active, PUBLIC_TASK_LIMIT),
      blocked: publicTaskSection(tasks.blocked, PUBLIC_TASK_LIMIT),
      recentCompleted: publicTaskSection(tasks.recentCompleted, PUBLIC_RECENT_LIMIT)
    },
    nextActions: (Array.isArray(status.dailyHome?.nextActions) ? status.dailyHome.nextActions : []).map(publicAction).filter(Boolean),
    sourceSummary: {
      ...countRuntimeEntries(root),
      primaryStateSources: [
        ARTIFACT_PATHS.state,
        ARTIFACT_PATHS.taskPacketsIndex,
        ARTIFACT_PATHS.runtimeResults,
        ARTIFACT_PATHS.runtimeEvents,
        ARTIFACT_PATHS.documentsLedger,
        ARTIFACT_PATHS.reviewState,
        ARTIFACT_PATHS.metaOperatorLessons
      ]
    },
    publicArtifacts: {
      json: ARTIFACT_PATHS.publicStatusJson,
      markdown: ARTIFACT_PATHS.publicStatusMarkdown,
      html: ARTIFACT_PATHS.publicStatusHtml
    },
    privacy: {
      sanitized: true,
      derivedOnly: true,
      rawDoveDumpIncluded: false,
      transcriptsIncluded: false,
      privateReasoningIncluded: false,
      environmentIncluded: false,
      runtimeEntriesIncluded: false,
      documentLedgerRawEntriesIncluded: false,
      documentBodiesIncluded: false,
      cloudflareTunnelStarted: false
    }
  };
}

export function publishDoveStatus(root, options = {}) {
  assertGovernanceMutationRegistered("publish-dove-status", "exempt");
  const snapshot = buildDovePublicStatus(root, options);
  const markdown = renderMarkdown(snapshot);
  const html = renderHtml(snapshot);
  writeJson(root, ARTIFACT_PATHS.publicStatusJson, snapshot);
  writeText(root, ARTIFACT_PATHS.publicStatusMarkdown, markdown);
  writeText(root, ARTIFACT_PATHS.publicStatusHtml, html);
  return {
    mode: "dove-public-status-publish",
    status: "published",
    generatedAt: snapshot.generatedAt,
    writes: [ARTIFACT_PATHS.publicStatusJson, ARTIFACT_PATHS.publicStatusMarkdown, ARTIFACT_PATHS.publicStatusHtml],
    publicArtifacts: snapshot.publicArtifacts,
    snapshot,
    privacy: snapshot.privacy,
    noDaemon: true,
    noScheduler: true,
    noExternalProcess: true,
    cloudflareTunnelStarted: false
  };
}
