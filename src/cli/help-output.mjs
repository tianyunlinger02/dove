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
  dove watch configure --project <root> --mentor <json-file> [--json|--format json]  # --mentor 是建议 JSON 文件路径
  dove topic start [--project <dir>] [--json|--format json]
  dove settings [--host-migration on|off] [--json|--format json]
  dove mentor brief [--project <dir>] [--trigger <text>] [--user-source <path>] [--since <range>] [--until <range>] [--user-original <text>] [--opinion <path>] [--artifact <path>...] [--json|--format json]
  dove run start --project <dir> [--id <id>] [--group <name>] [--seed <short-text>] [--wall-time <duration>|--timeout-ms <ms>] [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--data <basis>] [--evaluator <basis>] [--resource-basis <basis>] [--kill-grace-ms <ms>] [--json|--format json] -- <command> [args...]
  dove run status --project <dir> [--id <id>|--group <name>] [--json|--format json]
  dove run resume --project <dir> --id <id> [--json|--format json]
  dove run finalize --project <dir> --id <id> --metric-value <number> [--metric-name <name> --direction min|max] [--metric-unit <unit>] [--decision <text>] [--note <text>] [--json|--format json]
  dove run compare --project <dir> [--group <name>|--id <id>...] [--json|--format json]
  dove hook session-start --project <dir>
  dove hook user-prompt-submit --project <dir>
  dove hook statusline --project <dir>

普通 Claude 会话是 Dove 的主要入口；--agent dove 与九个 /dove:* Skills 只是可选快捷入口。CLI 管理项目接入、诊断和运行收据，不启动审稿模型。/dove:review 保留，导师 dove-mentor 与论文审稿 dove-review 使用宿主原生全新只读子 agent，不传执行对话、不续接历史。导师可检索网页和论文，靠自己的 MENTOR_NOTES.md 延续判断；审稿只读指定稿件与依据。

dove dashboard 在本机起一个网页，只读查看已登记项目的主线、核心能力、长期研究意图、当前轮次、EVAL 评测表和每轮说明/结果（默认 127.0.0.1:7788，远程用 SSH 端口转发打开；挂到公网隧道时用 --password-file 开启密码登录，所有页面和数据接口都要先登录）。面板的「设置」页可管理项目登记、论文追踪（关键词、作者、arXiv 分类、每天运行时间、代理、可选的 Semantic Scholar key）和面板密码；论文追踪在面板运行期间每天自动执行，也可用 dove watch run 手动执行，结果写入各项目 .dove/research/watch/。导师每次检查关键词、未判断论文和扫描，返回中文一句话与方向；有用论文累积为可导 BibTeX 的项目文献库。无新论文时补旧文默认关闭。选题先读标准，从正文近未成工作找缺口，跨领域找机制；候选写对应关系、前提、近邻差别与风险，经留下／修改／否掉评审，推荐两三个交用户选，之前不实现方法。面板可查看候选卡与文献库。

dove watch configure 显式保存导师追踪建议，只修改 --project 解析到的单个已接入项目。--mentor 接收 JSON 文件路径（相对路径按当前工作目录解析），不是内联 JSON 或导师文本；对象只允许 keywords、authors、venues、institutions、seedPapers 的字符串数组，至少提供一项。出现字段替换，缺席保留，[] 清空；enabled、categories 保持不变，source: mentor 只表示导师建议已落盘，不代表用户确认。此命令不调用导师、模型或网络，不执行追踪；watch run 行为不变。

科研记录用便于阅读的固定栏目和约略篇幅说明：身份卡包含目标档次和限制来源，轮次说明标作者，结果链接真实产物，EVAL 每方法版本一行。已有主线按用户原意推进，用能回答问题的规模评测；导师判断方向，执行者决定工程。连续两轮无科研结果就诊断，第三轮前找用户决定；换路线明说原路线、新路线和原因。已有 missions、experiments、claims 原地保留，不迁移删除；初始化只在没有研究树时建立简短 RESEARCH.md。

身份卡保留 Mainline、Current round 与 Round status；超长显示前 4KB。导师调用用 dove mentor brief 生成固定材料与固定问题，只附署名意见和新增原始产物路径。hostMigration 默认关闭，可在设置页或 CLI 开启：升级只登记迁移待办，SessionStart/UserPromptSubmit 只读送达，宿主在当前工作告一段落后处理，不停训练评测、不改结论或用户原话；完成后删除待办，同版不重复。开关关闭不送达迁移。Hooks 不写研究或授予权限，磁盘更新不等于活会话重载。
`;
}
