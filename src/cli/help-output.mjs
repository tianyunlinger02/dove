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
  dove dashboard [--port <port>] [--bind <address>] [--password-file <file>] [--json|--format json]
  dove watch run [--project <dir>] [--json|--format json]
  dove topic start [--project <dir>] [--json|--format json]
  dove run start --project <dir> [--id <id>] [--group <name>] [--seed <short-text>] [--wall-time <duration>|--timeout-ms <ms>] [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--data <basis>] [--evaluator <basis>] [--resource-basis <basis>] [--kill-grace-ms <ms>] [--json|--format json] -- <command> [args...]
  dove run status --project <dir> [--id <id>|--group <name>] [--json|--format json]
  dove run resume --project <dir> --id <id> [--json|--format json]
  dove run finalize --project <dir> --id <id> --metric-value <number> [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--decision <text>] [--note <text>] [--json|--format json]
  dove run compare --project <dir> [--group <name>|--id <id>...] [--json|--format json]
  dove hook session-start --project <dir>
  dove hook user-prompt-submit --project <dir>
  dove hook statusline --project <dir>

普通 Claude 会话是 Dove 的主要入口；--agent dove 与九个 /dove:* Skills 只是可选快捷入口。CLI 管理项目接入、诊断和运行收据，不启动审稿模型。/dove:review 保留，导师 dove-mentor 与论文审稿 dove-review 使用宿主原生全新只读子 agent，仅 Read/Grep/Glob，不传执行对话、不续接历史。

dove dashboard 在本机起一个只读网页，集中查看已登记项目的主线、当前轮次、EVAL 评测表和每轮说明/结果（默认 127.0.0.1:7788，远程用 SSH 端口转发打开；挂到公网隧道时用 --password-file 开启密码登录，所有页面和数据接口都要先登录）。面板的「设置」页可管理项目登记、论文追踪（关键词、作者、arXiv 分类、每天运行时间、代理、可选的 Semantic Scholar key）和面板密码；论文追踪在面板运行期间每天自动执行，也可用 dove watch run 手动执行，结果写入各项目 .dove/research/watch/，由导师在下一轮判断影响。dove topic start 把用户的选题标准（面板设置页维护）复制到项目 .dove/research/topics/CRITERIA.md，导师按它分阶段选题，候选卡在面板「选题」页查看。

科研核心记录是 .dove/research/IDENTITY.md、EVAL.md、rounds/。轮次说明标注作者（导师/用户/外部）；结果几行加 EVAL 一行。评测由用户确认一次，至少含一列未见类别的泛化结果；重要结果后的八维判断由导师给出。已有 missions、experiments、claims 原地保留，不迁移删除；初始化仍只在没有研究树时建立最小 RESEARCH.md。

身份卡顶部保留 Current round 与 Round status（ongoing/paused/completed）；超长显示前 4KB 并提示精简。SessionStart 与 UserPromptSubmit 只读呈现集成和指导。用户要求只讨论或停下，由主会话标为 paused。Hooks 不写研究或授予权限；完整加载新增宿主配置可能需要新会话。
`;
}
