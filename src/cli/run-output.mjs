function terminalSafeText(value) {
  return String(value ?? "").replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

export function renderRunMetric(metric) {
  if (!metric || metric.name === null || metric.name === undefined) return "未指定";
  const value = Object.hasOwn(metric, "value") ? `=${terminalSafeText(metric.value)}` : "";
  return `${terminalSafeText(metric.name)} ${terminalSafeText(metric.direction)}${metric.unit ? ` ${terminalSafeText(metric.unit)}` : ""}${value}`;
}

function renderRunSeed(seed) {
  if (seed?.declaration === "declared" && typeof seed.value === "string") return terminalSafeText(seed.value);
  return "未声明";
}

function renderGitFacts(result) {
  const commit = typeof result?.commit === "string" && result.commit ? result.commit : "unavailable";
  const dirty = result?.dirty === true ? "true" : result?.dirty === false ? "false" : "unavailable";
  return `commit ${terminalSafeText(commit)}；dirty ${terminalSafeText(dirty)}`;
}

export function renderRunResult(result) {
  if (result.command === "start") {
    return [
      "Dove run 已启动",
      "",
      `项目：${terminalSafeText(result.project)}`,
      `运行记录：${terminalSafeText(result.runId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `Supervisor PID：${terminalSafeText(result.supervisorPid)}`,
      `命令：${terminalSafeText(result.argv.join(" "))}`,
      `工作目录：${terminalSafeText(result.cwd)}`,
      `seed（用户声明）：${renderRunSeed(result.seed)}`,
      `Git：${renderGitFacts(result)}`,
      `日志：${terminalSafeText(result.paths.journalPath)}`,
      `stdout：${terminalSafeText(result.paths.stdoutPath)}`,
      `stderr：${terminalSafeText(result.paths.stderrPath)}`,
      "",
      "Run 记录只证明该命令的本地执行收据；科研结论仍需 Dove 根据真实结果判断。"
    ].join("\n");
  }
  if (result.command === "status" && Array.isArray(result.runs)) {
    const lines = ["Dove run 状态", "", `项目：${terminalSafeText(result.project)}`];
    if (result.group) lines.push(`分组：${terminalSafeText(result.group)}`);
    if (result.runs.length === 0) lines.push("", "尚无匹配的 .dove/runs/** 记录。");
    else lines.push("", ...result.runs.map((run) => `- ${terminalSafeText(run.runId)}：${terminalSafeText(run.status)}${run.group ? `，分组 ${terminalSafeText(run.group)}` : ""}${run.finalized ? `，指标 ${renderRunMetric(run.metric)}` : ""}`));
    return lines.join("\n");
  }
  if (result.command === "status") {
    return [
      "Dove run 状态",
      "",
      `项目：${terminalSafeText(result.project)}`,
      `运行记录：${terminalSafeText(result.runId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `生命周期：${terminalSafeText(result.lifecycle)}`,
      `已结束：${terminalSafeText(result.terminal)}`,
      `已 finalize：${terminalSafeText(result.finalized)}`,
      `退出码：${terminalSafeText(result.exitCode ?? "无")}`,
      `信号：${terminalSafeText(result.signal ?? "无")}`,
      `指标：${renderRunMetric(result.metric)}`,
      `seed（用户声明）：${renderRunSeed(result.seed)}`,
      `Git：${renderGitFacts(result)}`,
      `日志：${terminalSafeText(result.paths.journalPath)}`,
      `stdout：${terminalSafeText(result.paths.stdoutPath)}`,
      `stderr：${terminalSafeText(result.paths.stderrPath)}`,
      "",
      "PID 只作为观察信号，不是强身份。status 只读，不会修复或追加记录。"
    ].join("\n");
  }
  if (result.command === "resume") {
    return [
      "Dove run resume",
      "",
      `运行记录：${terminalSafeText(result.run?.runId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `动作：${terminalSafeText(result.action)}`,
      `写入：${terminalSafeText(result.write)}`,
      `说明：${terminalSafeText(result.reason)}`
    ].join("\n");
  }
  if (result.command === "finalize") {
    return [
      "Dove run 已 finalize",
      "",
      `运行记录：${terminalSafeText(result.summary.runId)}`,
      `指标：${renderRunMetric(result.event.metric)}`,
      `决定：${terminalSafeText(result.event.decision ?? "无")}`,
      `备注：${terminalSafeText(result.event.note ?? "无")}`
    ].join("\n");
  }
  if (result.command === "compare") {
    if (!result.comparable) {
      return [
        "Dove run compare",
        "",
        "可比较：false",
        `字段：${terminalSafeText((result.fields ?? []).join(", ") || "无")}`,
        "只比较 terminal 且 finalized，并且 metric、budget、data、evaluator、resource basis 完全一致的 runs；Git commit/dirty 只是运行事实，不参与可比性或排名。"
      ].join("\n");
    }
    return [
      "Dove run compare",
      "",
      "可比较：true",
      `指标：${renderRunMetric(result.basis.metric)}`,
      "Git commit/dirty 只是运行事实，不参与可比性或排名。",
      "",
      ...result.ranking.map((item) => `${terminalSafeText(item.rank)}. ${terminalSafeText(item.runId)} 指标值 ${terminalSafeText(item.metricValue)}，与最佳差值 ${terminalSafeText(item.deltaFromBest ?? "unavailable")}`)
    ].join("\n");
  }
  return JSON.stringify(result, null, 2);
}
