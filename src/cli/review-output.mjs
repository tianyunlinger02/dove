function terminalSafeText(value) {
  return String(value ?? "").replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

function renderObservedMaterialFact(item) {
  const observed = item?.observed ?? {};
  if (observed.type === "file") return `observed file ${terminalSafeText(observed.size)} bytes`;
  if (observed.type === "absent") return "observed absent";
  if (observed.type === "symlink") return "observed symlink (not followed)";
  if (observed.type === "directory") return "observed directory";
  if (observed.type === "special") return "observed special file";
  if (observed.type === "unsafe-path") return "unsafe stored material path";
  if (observed.type === "invalid-path") return `invalid stored material path${observed.error ? `: ${terminalSafeText(observed.error)}` : ""}`;
  if (observed.type === "unreadable" || observed.type === "unreadable-file") return `${terminalSafeText(observed.type)}${observed.error ? `: ${terminalSafeText(observed.error)}` : ""}`;
  return terminalSafeText(observed.type ?? "unavailable");
}

function renderExpectedMaterialFact(item) {
  const expected = item?.expected ?? {};
  return `snapshot ${terminalSafeText(expected.size ?? "unknown")} bytes`;
}

function renderMaterialCurrentness(currentness, label = "当前轮次材料") {
  const overall = terminalSafeText(currentness?.overall ?? "unavailable");
  const items = Array.isArray(currentness?.items) ? currentness.items : [];
  const lines = [`${label}：${overall}`];
  for (const item of items) {
    lines.push(`  - ${terminalSafeText(item.path ?? "未知路径")}：${terminalSafeText(item.status)}（${renderExpectedMaterialFact(item)}；${renderObservedMaterialFact(item)}）`);
  }
  if (currentness?.error) lines.push(`  - 材料版本检查失败：${terminalSafeText(currentness.error)}`);
  else if (items.length === 0) lines.push("  - 无 frozen materials 可比较。");
  return lines;
}

export function renderReviewResult(result) {
  if (result.command === "status" && Array.isArray(result.reviews)) {
    const lines = ["Dove review 状态", "", `项目：${terminalSafeText(result.project)}`];
    if (result.reviews.length === 0) lines.push("", "尚无 .dove/reviews/** 记录。");
    else lines.push("", ...result.reviews.map((review) => `- ${terminalSafeText(review.reviewId)}：${terminalSafeText(review.status)}，轮次 ${terminalSafeText(review.currentRound)}${review.sessionId ? `，会话 ${terminalSafeText(review.sessionId)}` : ""}`));
    return lines.join("\n");
  }
  if (result.command === "status") {
    const currentnessLines = renderMaterialCurrentness(result.materialCurrentness, "当前轮次材料版本关系");
    return [
      "Dove review 状态",
      "",
      `项目：${terminalSafeText(result.project)}`,
      `审阅记录：${terminalSafeText(result.reviewId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `当前轮次：${terminalSafeText(result.currentRound)}`,
      `会话：${terminalSafeText(result.sessionId ?? "无")}`,
      "",
      ...currentnessLines,
      "",
      "报告中的 verdict 是对应 frozen snapshot 的历史判断；status 不解析报告文字来猜 PASS/REVISE。",
      "",
      ...(result.rounds ?? []).map((round) => {
        const latest = round.latestReportPath ?? round.reportPath;
        const canonical = latest === round.reportPath ? "" : `；原始报告保留在 ${terminalSafeText(round.reportPath)}`;
        const currentness = round.materialCurrentness?.overall ? `；材料 ${terminalSafeText(round.materialCurrentness.overall)}` : "";
        return `- 轮次 ${terminalSafeText(round.round)}：${terminalSafeText(round.status)}（${terminalSafeText(round.provenance)}），报告 ${terminalSafeText(latest)}${canonical}${currentness}`;
      })
    ].join("\n");
  }
  const heading = {
    handoff: "Dove review handoff 已完成",
    resume: "Dove review 已恢复并更新当前轮次",
    rerun: "Dove review 已在同一 reviewer session 中开始新的完整轮次",
    import: "Dove review return 已导入"
  }[result.command] ?? "Dove review 完成";
  const materialLines = (result.materials ?? []).map((material) => `- ${terminalSafeText(material.path)} (${terminalSafeText(material.size)} bytes)`);
  return [
    heading,
    "",
    `项目：${terminalSafeText(result.project)}`,
    `审阅记录：${terminalSafeText(result.reviewId)}`,
    `轮次：${terminalSafeText(result.round)}`,
    `状态：${terminalSafeText(result.status)}`,
    `来源：${terminalSafeText(result.provenance)}`,
    `会话：${terminalSafeText(result.sessionId ?? "无")}`,
    `报告：${terminalSafeText(result.latestReportPath ?? result.reportPath)}`,
    `后端记录：${terminalSafeText(result.latestBackendPath ?? result.backendPath)}`,
    "",
    "冻结材料：",
    ...(materialLines.length > 0 ? materialLines : ["- 无；这是导入的外部返回记录"]),
    "",
    result.command === "import" ? "导入内容按用户提供文件原样保存；未声称由 Dove runtime reviewer 生成。" : "Reviewer 只接收本轮冻结材料；不会读取私有 transcript。"
  ].join("\n");
}
