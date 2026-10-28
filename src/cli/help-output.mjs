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
  dove figure --compare --before <file> --after <file> --width <length> --output <file.png> [--dpi <n>] [--project <root>] [--json|--format json]
  dove figure --proof --figure <file>@<length> [--figure <file>@<length> ...] --output <file.png> [--dpi <n>] [--project <root>] [--json|--format json]
  dove figure --pages <manuscript.pdf> [--body-pages <n>] --output <file.png> [--dpi <n>] [--project <root>] [--json|--format json]
  dove settings [--host-migration on|off] [--stop-prompts on|off] [--json|--format json]
  dove cold-read --pdf <manuscript.pdf> [--pdf <supplement.pdf>] [--venue <text>] [--project <dir>] [--json|--format json]
  dove mentor brief [--project <dir>] [--trigger <text>] [--user-source <path>] [--since <range>] [--until <range>] [--user-original <text>] [--opinion <path>] [--artifact <path>...] [--watch] [--json|--format json]
  dove hook session-start --project <dir>
  dove hook user-prompt-submit --project <dir>
  dove hook stop --project <dir>
  dove hook statusline --project <dir>

普通 Claude 会话是 Dove 的主要入口；--agent dove 与七个 /dove:* Skills 只是可选快捷入口。CLI 管理项目接入、诊断、面板和论文追踪，也可通过 dove figure 调用配置的图像模型，但不启动审稿模型。导师 dove-mentor 与论文审稿 dove-review 使用宿主原生全新只读子 agent，不传执行对话、不续接历史。导师可检索网页和论文，靠自己的 MENTOR_NOTES.md 延续判断；审稿只读指定稿件与依据。

Dove 围绕用户最终要的完整方法和能力工作，身份卡的 Mainline、Core capability、Completion 与真实输入输出定义目标；局部指标、诊断和记录完善不能代偿最终结果没做成。记录情境只提供当前具体改法、已有真实效果、见分晓时间、超时与历史停滞及有来源的待答复事项，不以补表或评分催促工作。状态栏显示本轮具体目标和主指标；八维按需分析，不决定下一轮。历史超时和停滞不自动等于当前待用户决定。Stop 在超时或停滞时各引用一次用户原话，先核对最新决定，确实未决定才问；dove settings --stop-prompts off 可关掉。指导更新后，每个会话只提示一次重读操作说明和“用户最常说的话”。

dove figure 调用 settings.figure（baseURL、model，可选 apiKeyEnv）配置的图像模型，向服务发送 prompt 和输入图；用户配置了图像服务并要求画图，就是对这些请求的授权，不必每次另行确认。无 --image 时生成，有图时编辑，--image 可重复；图片和输出可在任意位置，相对路径按 --project（默认当前目录）解析，输出文件已存在时自动加序号，不覆盖。密钥依次取 Dove 配置目录里的 figure-api-key 文件、apiKeyEnv 指定的环境变量；图像接口就是宿主所用的模型网关时，也用宿主已有的密钥。遇到限流或网关错误会自动重试，失败时显示服务返回的原因。它用来做构图和示意素材，真实结果与文字在 PPT 里组合；dove figure --tools 列出本机做 PPT 的 Python、PPTX 转 PDF 与 PDF 转 PNG 的命令。CLI 不能调用宿主内置 image_gen，Claude Code 宿主也没有这种工具。

dove figure --compare 把同一张图的改前和改后按投稿里的实际宽度（如 83.34mm、3.28in、236.84pt）排成对照，单栏图并排、通栏图上下排；--proof 把整套图各按自己的实际宽度排进一张总览，单栏图两两并排、通栏图独占一行，用来对照字号阶梯、配色和着色方式。输入是 PNG、JPEG、WebP 或 PDF（取第一页），默认 150 dpi；位图按 300 dpi 印刷不够清晰时会提示。合成用 dove figure --tools 找到的带 python-pptx 的 Python（自带 Pillow），PDF 用 pdftoppm 转换；相对路径按 --project 解析，输出文件已存在时自动加序号。dove figure --pages 把编译好的稿件 PDF 所有页排成一张版面总览，标出各栏底部空白、中间大片空白和几乎只放图表的栏，并按参考文献标题算出正文用了几页；给 --body-pages（如 8）时再和正文页数上限比较。需要 pdftoppm 和 pdftotext。

dove dashboard 在本机起一个网页，优先查看已登记项目的主线与核心能力、方法设计、当前实际工作和真实评测结果；轮次、历史提醒和记录事项在后，八维与投入历史默认折叠，不展示预测校准与写法偏差统计。另有跨项目经验和各项目反复出现的纠正（默认 127.0.0.1:7788，远程用 SSH 端口转发打开；挂到公网隧道时用 --password-file 开启密码登录，所有页面和数据接口都要先登录）。面板的「设置」页可管理项目登记、论文追踪（关键词、作者、arXiv 分类、每天运行时间、代理、可选的 Semantic Scholar key）和面板密码；论文追踪在面板运行期间每天自动执行，也可用 dove watch run 手动执行，结果写入各项目 .dove/research/watch/。导师每周判断一次追踪结果（或用户要求时，dove mentor brief --watch），返回中文一句话与方向；有用论文累积为可导 BibTeX 的项目文献库。无新论文时补旧文默认关闭。

dove watch configure 显式保存导师追踪建议，只修改 --project 解析到的单个已接入项目。--mentor 接收 JSON 文件路径（相对路径按当前工作目录解析），不是内联 JSON 或导师文本；对象只允许 keywords、authors、venues、institutions、seedPapers 的字符串数组，至少提供一项。出现字段替换，缺席保留，[] 清空；enabled、categories 保持不变，source: mentor 只表示导师建议已落盘，不代表用户确认。此命令不调用导师、模型或网络，不执行追踪；watch run 行为不变。

dove cold-read 为冷读做准备，本身不调用任何模型：把编译好的稿件 PDF 转成逐页文字和页面图片，放在项目外的临时目录，并输出调用正文；宿主把正文原样交给一个全新的 dove-review，读者只看这份稿件，不读源码、结果或项目背景，返回读完第一页的理解、行话清单、读不懂的地方、防御性措辞、图表和版面问题。需要 pdftotext 和 pdftoppm。

dove mentor brief 生成导师调用材料：用户原话摘录、身份卡里的完整目标和核心能力、明确提供的原始结果、Dove 算出的事实，以及宿主记录的目录。hostMigration 默认关闭，开启后升级只登记一次待办，宿主在工作告一段落时处理，不停任务、不改结论或原话。磁盘更新不等于活会话重载。
`;
}
