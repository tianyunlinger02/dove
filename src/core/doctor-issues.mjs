function issue(issueId, category, severity, summary, action, detectedBy) {
  return { issueId, category, severity, summary, action, detectedBy };
}

export function doctorIssuesFromInspection(inspection, options = {}) {
  const detectedBy = options.detectedBy ?? "doctor";
  const issues = [];
  if (inspection.userCli?.healthy === false) {
    issues.push(issue("dove-software-invalid", "software", "error", "Dove 软件或运行文件需要修复", "重新安装或升级用户级 Dove", detectedBy));
  }
  if (inspection.migrationInstallation?.state === "valid-legacy") {
    issues.push(issue("project-upgrade-available", "project-integration", "warning", "当前项目可以从旧版 Dove 集成升级", "dove upgrade", detectedBy));
  }
  if (inspection.projectIntegration?.state === "needs-sync") {
    issues.push(issue("project-needs-sync", "project-integration", "warning", "当前项目集成需要更新", "dove sync", detectedBy));
  } else if (["invalid", "drifted"].includes(inspection.projectIntegration?.state)) {
    issues.push(issue("project-integration-invalid", "project-integration", "error", "当前项目集成需要人工处理", "dove doctor", detectedBy));
  }
  if (inspection.workspaceState?.state === "previous-research-format") {
    issues.push(issue("research-format-export", "research-state", "warning", "旧版 JSON 科研记录需要显式导出为 Markdown", "dove export-research", detectedBy));
  } else if (inspection.workspaceState?.healthy === false) {
    issues.push(issue("research-state-invalid", "research-state", "error", "Dove 研究文档无法安全读取", "dove doctor", detectedBy));
  }
  if (inspection.legacyCopiedRuntime?.detected === true || inspection.legacyCopiedRuntime?.healthy === false) {
    issues.push(issue("legacy-copied-runtime", "project-integration", "error", "当前项目中发现旧版 Dove 复制运行文件", "dove upgrade 或 dove reinstall", detectedBy));
  }
  return issues;
}
