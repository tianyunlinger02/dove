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
  dove figure --project <root> (--prompt <text>|--prompt-file <file>) [--image <file> ...] --output <file.png> [--size <size>] [--quality <q>] [--background <b>] [--json|--format json]
  dove figure --tools [--json|--format json]
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

普通 Claude 会话是 Dove 的主要入口；--agent dove 与九个 /dove:* Skills 只是可选快捷入口。CLI 管理项目接入、诊断和运行收据，也可通过 dove figure 调用配置的图像模型，但不启动审稿模型。/dove:review 保留，导师 dove-mentor 与论文审稿 dove-review 使用宿主原生全新只读子 agent，不传执行对话、不续接历史。导师可检索网页和论文，靠自己的 MENTOR_NOTES.md 延续判断；审稿只读指定稿件与依据。

dove figure 调用 settings.figure（baseURL、model，可选 apiKeyEnv）配置的图像模型，向服务发送 prompt 和输入图；用户配置了图像服务并要求画图，就是对这些请求的授权，不必每次另行确认。无 --image 时生成，有图时编辑，--image 可重复；图片和输出可在任意位置，相对路径按 --project（默认当前目录）解析，输出文件已存在时自动加序号，不覆盖。密钥依次取 Dove 配置目录里的 figure-api-key 文件、apiKeyEnv 指定的环境变量；图像接口就是宿主所用的模型网关时，也用宿主已有的密钥。遇到限流或网关错误会自动重试，失败时显示服务返回的原因。它用来做构图和示意素材，真实结果与文字在 PPT 里组合；dove figure --tools 列出本机做 PPT 的 Python、PPTX 转 PDF 与 PDF 转 PNG 的命令。CLI 不能调用宿主内置 image_gen，Claude Code 宿主也没有这种工具。

dove dashboard 在本机起一个网页，只读查看已登记项目的主线、核心能力、长期研究意图、当前轮次、EVAL 评测表和每轮说明/结果（默认 127.0.0.1:7788，远程用 SSH 端口转发打开；挂到公网隧道时用 --password-file 开启密码登录，所有页面和数据接口都要先登录）。面板的「设置」页可管理项目登记、论文追踪（关键词、作者、arXiv 分类、每天运行时间、代理、可选的 Semantic Scholar key）和面板密码；论文追踪在面板运行期间每天自动执行，也可用 dove watch run 手动执行，结果写入各项目 .dove/research/watch/。导师每次检查关键词、未判断论文和扫描，返回中文一句话与方向；有用论文累积为可导 BibTeX 的项目文献库。无新论文时补旧文默认关闭。选题先读标准，从正文近未成工作找缺口，跨领域找机制；候选写对应关系、前提、近邻差别与风险，经留下／修改／否掉评审，推荐两三个交用户选，之前不实现方法。面板可查看候选卡与文献库。

dove watch configure 显式保存导师追踪建议，只修改 --project 解析到的单个已接入项目。--mentor 接收 JSON 文件路径（相对路径按当前工作目录解析），不是内联 JSON 或导师文本；对象只允许 keywords、authors、venues、institutions、seedPapers 的字符串数组，至少提供一项。出现字段替换，缺席保留，[] 清空；enabled、categories 保持不变，source: mentor 只表示导师建议已落盘，不代表用户确认。此命令不调用导师、模型或网络，不执行追踪；watch run 行为不变。

主线确认后先打通官方指标、真实开发集和最强可得外部比较。新方法或核心模块先用三段白话讲真实失败、外部方法的具体不足、改法及成败预期，用户看过再实现；面板显示轮次说明里的同一份论证。日常修复不重走此关口。连续两轮无新科研结果（工程和修评价也算）就停下问用户：继续当前方法、换方法还是换方向。科研记录便于阅读，EVAL 每方法一行，结果链接真实产物；旧 missions、experiments、claims 保留，不新增。

身份卡的研究状态约300字白话，钩子优先展示它。dove mentor brief 把用户原话摘录和明确提供的原始文本产物放在宿主简报前；导师先答实质进展一句话、最近是在研究还是工程，再核对三段论证及过去纠正。hostMigration 默认关闭，开启后升级只登记待办，宿主在工作告一段落时处理，不停任务、不改结论或原话。Hooks 不写研究，磁盘更新不等于活会话重载。
`;
}
