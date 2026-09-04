function terminalSafeText(value) {
  return String(value ?? "").replace(/[\x00-\x1f\x7f-\x9f]/gu, "?");
}

export function renderReviewResult(result) {
  if (result.command === "status" && Array.isArray(result.reviews)) {
    const lines = ["Dove review 状态", "", `项目：${terminalSafeText(result.project)}`];
    if (result.reviews.length === 0) lines.push("", "尚无 .dove/reviews/** 记录。");
    else lines.push("", ...result.reviews.map((review) => `- ${terminalSafeText(review.reviewId)}：${terminalSafeText(review.status)}，轮次 ${terminalSafeText(review.currentRound)}${review.sessionId ? `，会话 ${terminalSafeText(review.sessionId)}` : ""}`));
    return lines.join("\n");
  }
  if (result.command === "status") {
    return [
      "Dove review 状态",
      "",
      `项目：${terminalSafeText(result.project)}`,
      `审阅记录：${terminalSafeText(result.reviewId)}`,
      `状态：${terminalSafeText(result.status)}`,
      `当前轮次：${terminalSafeText(result.currentRound)}`,
      `会话：${terminalSafeText(result.sessionId ?? "无")}`,
      "",
      ...(result.rounds ?? []).map((round) => {
        const latest = round.latestReportPath ?? round.reportPath;
        const canonical = latest === round.reportPath ? "" : `；原始报告保留在 ${terminalSafeText(round.reportPath)}`;
        return `- 轮次 ${terminalSafeText(round.round)}：${terminalSafeText(round.status)}（${terminalSafeText(round.provenance)}），报告 ${terminalSafeText(latest)}${canonical}`;
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
