export function renderDoveHelp() {
  return `dove

用法：
  dove --help
  dove --version
  dove init [--project <dir>] [--host <host>...] [--json|--format json]
  dove update [--project <dir>] [--host <host>...] [--json|--format json]
  dove reinstall [--project <dir>] [--json|--format json]
  dove uninstall [--project <dir>] [--json|--format json]
  dove doctor [--project <dir>] [--json|--format json]
  dove projects import --project <dir>... [--sync] [--json|--format json]
  dove projects sync [--json|--format json]
  dove projects status [--json|--format json]
  dove review handoff --project <dir> --venue <venue> --material <path>... [--id <id>] [--json|--format json]
  dove review status --project <dir> [--id <id>] [--json|--format json]
  dove review resume --project <dir> --id <id> [--json|--format json]
  dove review rerun --project <dir> --id <id> --material <path>... [--venue <venue>] [--json|--format json]
  dove review import --project <dir> --id <id> --file <report.md> [--venue <venue>] [--material <path>...] [--json|--format json]
  dove run start --project <dir> [--id <id>] [--group <name>] [--seed <short-text>] [--wall-time <duration>|--timeout-ms <ms>] [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--data <basis>] [--evaluator <basis>] [--resource-basis <basis>] [--kill-grace-ms <ms>] [--json|--format json] -- <command> [args...]
  dove run status --project <dir> [--id <id>|--group <name>] [--json|--format json]
  dove run resume --project <dir> --id <id> [--json|--format json]
  dove run finalize --project <dir> --id <id> --metric-value <number> [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--decision <text>] [--note <text>] [--json|--format json]
  dove run compare --project <dir> [--group <name>|--id <id>...] [--json|--format json]
  dove hook session-start --project <dir>
  dove hook user-prompt-submit --project <dir>
  dove hook statusline --project <dir>

Dove 负责把当前项目接入支持的宿主，并提供 doctor、review、run 与 hook 等项目级命令。真正的科研推进仍在一个 Dove agent 中完成；研究记录是研究者维护的普通 Markdown。初始化只创建最小入口 \`.dove/research/RESEARCH.md\`，不代表已经完成研究、结论或验证。Claude 接入管理只读 SessionStart hook，并在没有现有用户配置时安装只读 statusLine；UserPromptSubmit 只读检查当前项目的受管集成；校验通过时对每条 prompt 交付当前 CLI 的有界科研指导和文件指纹，引导原会话主 agent 按需亲自补读新版全文，而非宿主规则热重载；校验失败时仅提示检查集成，不分类、不读写研究内容、不授予权限或阻塞请求。默认不安装 Stop hook；兼容性 dove hook stop 命令因无法获知用户本轮请求而放行，不会强制续行。
`;
}
