import {
  DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
  DOVE_RESEARCH_REVIEW_AGENT_NAME,
  DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY,
  DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
  DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
  DOVE_RESEARCH_QUALITY_REFERENCE_PATH
} from "./dove-research-contract.mjs";
import { EXA_WEB_SUPPORT_SKILL_PATH } from "./web-access-integration.mjs";
import { DOVE_AGENT_SURFACES } from "./dove-agent-definition.mjs";
import { DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH, DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATH } from "./dove-author-preferences.mjs";
import { DOVE_TOPIC_CRITERIA_REFERENCE_PATH } from "./dove-topic-criteria.mjs";

export const PACKAGE_DOCUMENTATION_PATHS = ["README.md", "docs/README.md", "docs/AUTHOR_PREFERENCES.md", "docs/TOPIC_CRITERIA.md", "docs/INSTALL.md", "docs/USAGE.md", "docs/PACKAGING.md", "docs/CAPABILITY_MATRIX.md", "docs/DOVE_COMMAND_OUTPUT_SAMPLES.md"];
export const PACKAGE_LEGAL_PATHS = ["LICENSE", "THIRD_PARTY_NOTICES.md"];
export const PACKAGE_BRAND_PATHS = ["dove.png"];
export const PACKAGE_RUNTIME_PATHS = ["dist/index.mjs", "bin/dove-package.mjs"];
export const PROJECT_HOST_IDS = ["claude"];
export const DOVE_REFERENCE_PATHS = Object.freeze([
  DOVE_RESEARCH_QUALITY_REFERENCE_PATH,
  DOVE_TOPIC_CRITERIA_REFERENCE_PATH,
  DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH,
  DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATH
]);
export const DOVE_CLAUDE_AMBIENT_PROJECT_PATHS = Object.freeze([
  ".claude/rules/dove.md",
  ...DOVE_REFERENCE_PATHS,
  ".claude/skills/dove-paper-search/SKILL.md",
  ".claude/skills/dove-web-reader/SKILL.md",
  ".claude/settings.json"
]);
export const PACKAGE_RESOURCE_ROOT = "package-resources/hosts";
export const PACKAGE_GENERATED_SUPPORT_PATHS = Object.freeze([
  ...Object.values(DOVE_AGENT_SURFACES).map((agentPath) => `${PACKAGE_RESOURCE_ROOT}/claude/${agentPath}`),
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/rules/dove.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/.claude/skills/dove-paper-search/SKILL.md`,
  `${PACKAGE_RESOURCE_ROOT}/claude/${EXA_WEB_SUPPORT_SKILL_PATH}`,
  ...DOVE_REFERENCE_PATHS.map((referencePath) => `${PACKAGE_RESOURCE_ROOT}/claude/${referencePath}`)
]);
export const HOST_DEFINITIONS = {
  claude: { label: "Claude Code", scope: "project", jsonChecks: [] }
};

// The shared tool rules live once in the operating manual; a Skill lists only its own tool notes.
const DEFAULT_HOST_GUIDANCE = Object.freeze({ common: Object.freeze([]), claude: Object.freeze([]) });

function hostGuidance(extra = {}) {
  return Object.fromEntries(["common", "claude"].map((hostId) => [hostId, [
    ...(DEFAULT_HOST_GUIDANCE[hostId] ?? []),
    ...(extra[hostId] ?? [])
  ]]));
}

function capabilityContract(options) {
  return {
    ...options,
    hostGuidance: options.hostGuidance ?? hostGuidance()
  };
}

function contract(slug) {
  if (slug === "research") return capabilityContract({
    ambientParticipation: "选题按操作说明找候选；已确认主线或已授权的具体任务，直接做范围内的实质工作。",
    purpose: "帮用户选研究方向，或在确认的主线上取得实质进展。",
    when: "选题、形成方法或接续已有研究时使用。",
    actions: [
      "选题按操作说明和研究标准的“选题与新意”找有来源的缺口、跨域机制，检查候选的最强反对；用 Source 带问题读正文，候选卡链接证据。",
      "主线内用成熟资产补齐已获准方法的完整输入输出链路，沿真实结果定位最大瓶颈；用 Experiment 区分实现缺口、方法缺陷和评价问题，形成具体改法，而不是不断复查已知失败。",
      "接续时先看身份卡、EVAL 开头的主指标和八维走势、本轮说明、当前方法设计及导师笔记里已确认的关系、有效负证据和被否掉的方法；保留已确认主线，普通修复不重开选题，再决定下一步做什么。"
    ],
    boundaries: [
      "用户选主线前不实现候选方法，只做选题标准允许的诊断；已授权实现、修复和复现不因此重开选题。普通问题保持范围，只读或只设计请求不执行。"
    ]
  });
  if (slug === "status") return capabilityContract({
    ambientParticipation: "只说明做成什么、核心是否证实、卡在哪里和当前轮次，不启动新工作。",
    purpose: "简洁、据实说明当前研究状态。",
    when: "用户问进展或未解决问题时使用。",
    actions: [
      "以用户最新问题和实际上下文为准，读 IDENTITY.md、EVAL.md 开头的主指标和八维走势、最近几行方法版本和本轮说明，说明做成了什么、真实结果、意义和下一步。问整体情况就先讲清项目问题、方法和已有能力；局部问题直接答。解释数字和比较对象，区分核心未实现、实现故障和方法效果未知；记录中的历史停滞或缺答复不等于用户当前尚未决定。"
    ],
    boundaries: ["状态查询只读，不跑研究或更新文档。"]
  });
  if (slug === "source") return capabilityContract({
    ambientParticipation: "用实读来源回答问题、拓宽想法，并改进受影响的设计或主张。",
    purpose: "发现、获取、阅读和核实能改变研究决定或回答具体问题的来源。",
    when: "查文献、读来源、核引文身份和主张、比较相关工作或系统综述时使用。",
    actions: [
      "从用户问题和已有笔记出发，分清发现来源、核实引文身份、读正文、证明主张，互不替代。引文先查 DOI 再模糊搜标题，核对标题、作者、年份、场合／版本，报告冲突、缺失与未知。",
      "正文细节带 1–5 个具体问题读全文，按研究标准在 `.dove/research/papers/<id>.md` 累积问答。复用旧答案，只补新答并标章节、页码或公式，保留旧答；只核查的任务返回答案，不建笔记或改稿。",
      "拆开复合主张，逐项标支持、反驳或未覆盖，附相关段落、公式、算法或代码及限制。新意和重合判断用累积笔记，链接受影响产物，建议与实际支持一致的表述，不拿半句支持整句。",
      "跨领域按相同贡献粒度找真实近邻，选题时按选题标准。从来源的真实问题与机制形成候选，不先定方案再收窄问题；查明已有工作可直接借用什么、哪项有价值的改进还没解决，再以近邻和反例校准。重合本身不否定改进，完整覆盖的贡献也不靠改名恢复；落实到设计或主张，继续检索已不会改变决定就停。",
      "明确做系统综述或元分析时才定义问题、检索范围、纳排标准，按适用 PRISMA 记录、偏倚与证据把握评估，只合并可比效应。普通检索不加这套流程；有用链接或综合认识改变时才更新 `sources/SOURCES.md`。"
    ],
    boundaries: [
      "片段、摘要、元数据或没搜到结果，都不能证明读过全文或不存在重合。工具缺失或失败就用 WebFetch、arXiv／Crossref API、curl 下载等方式取来源，说清实际读到什么。"
    ],
    hostGuidance: hostGuidance({
      claude: ["WebSearch 用于发现来源，dove-paper-search 查 DOI 元数据和论文，普通网页与已知链接用托管 exa 或 WebFetch。"]
    })
  });
  if (slug === "experiment") return capabilityContract({
    ambientParticipation: "从真实输出和失败形成解释与改法，用公平比较区分方法效果、实现错误和评价问题。",
    purpose: "开发、复现和评价方法，让证据回答研究问题。",
    when: "已授权的开发、诊断、确认、复现或结果分析时使用。",
    actions: [
      "解释结果前查相关代码、数据、配置、输出与分析，先核对核心计算是否完整、失败发生在哪一步。缺实现就补，已知原因就修，关键原因尚不清楚才用诊断区分解释；按研究标准的“从问题到方法”推出改法和预期。新方法或新核心模块先交方法设计让用户看过；模型学不会时可用单例过拟合诊断学习机制，不先靠更多数据或更大评价器补救。",
      "规模、对照和判定按操作说明的“每轮开始”“每轮结束”：先算预期差别和噪声再定规模，互不依赖的方案同时试。开发保留代码与诊断记录，按关键未知选测试，不要求每次修改全评；但每轮的方法结果要有真实评测数字，训练或合成分布不能替代。",
      "完整任务对强同输入外部方法判断效用，消融和受控比较判断归因。预算、不确定性及失败、缺失、无效输出怎么算都写清；正式比较按研究标准“证据与实验”的协议执行，未测效果留未知，新版不继承旧版通过结论。",
      "主执行者修评价并立即标受影响结果；先复用原始输出，恢复当前主张、必要历史比较和强基线的可比性，再重跑必要版本。不用于当前判断的旧结果可标旧协议历史，用前再恢复，不要求先重跑全部历史，不混协议、不藏负证据。只修协议不等于换方法版本；若改变目标含义就问用户。"
    ],
    boundaries: [
      "只读或只设计不执行；用于调参的保留集不再是独立最终证据。"
    ]
  });
  if (slug === "draft") return capabilityContract({
    ambientParticipation: "在权威稿件中据证据写作，用论文的语气扬长避短，也按审稿意见修改并写作者回应，落实到检查过的实际产物和版面。",
    purpose: "写作、评估或修改指定稿件、章节或承载主张的产物，也包括按审稿意见修改和写作者回应。",
    when: "用户要求写改，论证、表达、交付产物需要处理，或要回应、落实审稿意见时使用。",
    actions: [
      "读目标文本与主张证据，动笔前先回答：审稿人读完摘要应记住哪个论点？用可迁移、由受控证据支撑的发现连清问题、缺口、洞见、方法和边界，不以‘系统更好’或一串结果代替论点。同一论点的多组证据并排讲，最重要的发现放进摘要和引言，说明它带来的能力转变及为什么重要。改写不暗中加强或削弱主张：确定性、因果、范围、数量和新意都按证据说，证据要求改主张时先说明；处理范围内的来源、方法、证据或图缺口，不只弱化文字，文笔好不等于贡献成立。",
      DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
      "动笔或大改前，选 2–3 篇同方向、同投稿版式、近两年已录用的论文，优先作者已引用的强相关工作，读 PDF 原文逐项对照：各节篇幅和首图页码；引言每段怎样从问题、已有方法缺口推到核心想法和贡献，实验怎样按结论、图表、解释组织；每张图表承担什么证据、放在哪里；介绍贡献、报告主结果、写消融和局限时的典型句式与用词，以及字体、记号和表格惯例。记下页码和本稿采用的决定，放在稿件旁（如 paper/REFERENCE_LAYOUT.md），同一篇稿件复用，写改时逐项对照。学论证结构和句子功能，不照抄句子，也不照搬图表数量。",
      "动笔前在稿件旁列‘内部名 → 论文用语’读者词表，同一稿复用，正文、表格、图内标签和补充都从它取名；轮次、实验臂名、内部路径、调试状态和协议代号不进稿件。集合首次出现说清大小与用途，用 test set、development set 等读者能懂的名字；缩写和自定义概念在正文首次出现处用半句白话解释，不只在补充定义。一个量只用一个名字和符号，定稿时逐项核对全文、图表和补充；模型名、参数量与版本各指什么也说清，不另造第三个名字。",
      "逐句检查论文语言，不只查能否读懂：核心论断是否在摘要、引言和结论里机械复述同一固定说法，可用全文检索定位，按段落功能合并或改写，但同一量和技术术语不为换词而改名；顺手自造的概念词能否换成直白描述，比喻是否侵入方法和实验而模糊真实操作。核对介词搭配、施事主语和悬垂修饰语，无生命主语须确实能承担该动作；分别对应的两组对象用 respectively 或拆句说清，which、it、each、both、its 都就近指明对象。摘要、引言与标题避免口语反问，用准确的陈述或学术问题标题；参照录用论文在引言用 We present <方法名> 等框架点名，贡献用 We introduce / We train / We show 等完整句而非加粗口号，结论回顾已做成什么（如 We introduced），按本稿内容写，不套固定原句。定性说法也核对表中数字，seconds rather than minutes 这类对比只有数字确实支持才用。",
      "先按投稿正文页数定版面预算再写，与 Figure 共用稿件旁同一张‘论点—证据—位置—尺寸’表：每条论点由哪张图或表支持，正文还是补充、靠近哪一节，单栏还是通栏、实际栏宽和目标高度。图表总量按预算定，正文写满允许上限（如 CVPR 8 页、不含参考文献）；不足时补动机、直觉、例子和分析，或把补充里最强的证据移回正文，超出时先删冗余句，再把次要图表和外围内容移到补充，不先压掉必要解释。联动顺序是 Draft 定预算 → Figure 按尺寸画 → Draft 放入、核图注和引用、编译看版面；不合适先调位置与取舍，必要时请 Figure 改尺寸，并更新同一张表。",
      "按论文写，不写成实验报告，立场是扬长避短：贡献和强项正面陈述，证据直接给关键数字。限定只在必要处说一次，集中放在局限段；局限段只列真正必要的边界，不罗列每个小缺点；弱项在正文一两句带过、说清能改进的方向，细节放补充材料；不在摘要结尾、正文各处或图注里反复加免责。摘要一般按“问题 → 已有方法的不足 → 核心想法 → 由此获得的能力 → 一两句关键结果 → 机制上的结论”写，只带一两个关键数字；实验每段先给一句结论，再指向图表；完整数字、分母、协议和设置进表格、实验节和补充材料。缺材料问作者，不把‘未提供’塞进稿件。在准确和投稿规范内检查整篇论证影响，不把局部写作扩成新研究。",
      "在指标定义处写清成功口径：各方法要完成哪些步骤、无效或失败输出怎么算，不让‘生成完成’与‘经过后续仿真和检查通过’只靠表注区分；表里写分母及计数单位，是样本、编辑次数还是别的。并列的数字来自不同模型、规模或样本子集时，就在该句数字旁标明，不让读者去补充里找；比较使用同一层级和同一口径，不拿结构有效率直接比仿真通过率。主动交代影响比较的训练数据、上下文长度、解码上限和计算预算差异，实际测到的基线成功率与集合规模直接给，不用‘时间限制’带过。数字从原始未舍入读数按约定单位与精度一次舍入，不从旧稿或已舍入数字再抄；结果更新后同步所有引用处。",
      "对照投稿模板和参考论文实看字体、表格与全文惯例：行内代码和 token 用与正文字体配套的等宽体，保持正文正常字号，不用 \\small 缩号；放大渲染段落看字高、粗细，并与图内 token 对齐，不为所有论文硬定一种字体。表头写清指标方向（↑/↓）和单位，单元格不重复单位，同列精度一致，分母仍在表内说清；文字和数字用与正文配套的文本字体，不用数学粗体代替普通数字加粗，表注说明实验设置与加粗含义，不塞进左上角；行名用准确语法。超宽先将表头分行或缩短行名，再调列距或布局，不用 \\resizebox 整体缩表。正文、补充和图内文字同遍检查标题大小写、美式拼写、千分位与 vs. 等写法；图中失败标签按实际失败类型统一措辞，图例靠近对象，实看易混字形和方法名。",
      "用 `.dove/research/papers/library.json` 和 `library.md` 按方向组织相关工作，每组以本文和这组工作的区别收尾；据 `papers/<id>.md` 核主张支持。引用或导出 BibTeX 前用 Source 核元数据，只导已核字段，不编作者、场合、日期或标识。显式积累或后续 watch 才更新库，只读不写。",
      "写稿方负责 tex、图注与正文，出图方负责图内文字；任一方改动后，另一方回查同名、同符号、子图编号和引用，文字改名也要回查图，不只是换图后核图注。双方并行改稿或改图时分清各自文件；出图方要切分支就用独立工作区，若共用同一工作区则先交接当前分支与未提交改动，提交前核对所在分支，不把对方改动带进自己的提交。再走实际构建／导出路径，每次编译都实看结论最后一行所在页，不只找 Conclusion 标题，小改也可能重排浮动体；溢出先删与前文重复的句子，再按版面预算取舍。编译后检查溢出框、未定义引用、图表编号、双栏宽表是否通栏，逐页看空栏、只放浮动体的栏、大片空白（dove figure --pages <稿件.pdf> --body-pages <正文页数上限> --output <总览.png> 把所有页排成一张总览，标出这些位置，并按参考文献标题算出正文实际用了几页），以及图表是否离首次引用超过一页、排到结论之后或参考文献页、正文是否提前结束而没用足页数。正文字数从源码算，排除表格、图注和参考文献，与目标核对；按投稿要求核对正文页数（含图表），保持最终字号和关键证据。收尾把全文逐页渲染，一次看完版面、图文邻近、图注一致和整套图风格，看过输出才称当前稿；修范围内问题，说明剩余材料限制。用户要的阅读版（如中英对照）在每轮实质修改后按当前权威源重新生成；图件变化后预览图从当前导出 PDF 重出，不复用旧预览，交付前核对它们与源稿是同一版。",
      "LaTeX 稿件在投稿模板允许的范围内默认放宽浮动参数：\\renewcommand{\\topfraction}{0.9}、\\renewcommand{\\dbltopfraction}{0.9}、\\renewcommand{\\textfraction}{0.08}、\\renewcommand{\\floatpagefraction}{0.9}、\\setcounter{topnumber}{3}。仍排不下时调整图表在源文件里的位置或内容取舍，不靠负间距或缩字号塞版面。",
      "补充材料是给读者的论文，不是开发记录：去掉无谓的 \\clearpage、开发用样本 ID、原始路径、历史版本标签和横幅；样本与原始文件的追溯映射留在项目来源记录。必要的图片选择与可视化说明简洁并入协议节，不单独堆成过程说明。",
      "每次交给用户或投稿之前都做终检，按顺序：先按 Review 做语言与排版对照审查，依据录用论文逐句查正文、补充和图内文字，处理后重编译并用 dove figure --pages 看版面；再按 Review 的冷读闭环逐条改，图内问题交 Figure，改完重新编译再由全新读者冷读，未解决的‘必须改’清零才称交付就绪；事实与数字疑点由掌握原始读数的一方核实，再核对摘要、引言、正文、表格、图注和补充中的单位、精度、名字及数值一致，不把原始读数塞给冷读者。正文每处指向补充的引用都能找到，补充单独编译并看版面；双盲投稿查作者信息、致谢、带用户名或机构的链接、第一人称自引、PDF 元数据和补充文件。后续核数或匿名修正又改了稿件，也重新编译并复读当前版。交付说明写清对照审查和冷读发现了什么、改了什么及有依据未采纳的意见，只查编译、页数和数字不算终检。这是写稿方的交付自查，不另建审批，不阻断用户直接要的局部改动或要求用户批准检查。",
      "模板缺字体或包时，用允许工具放在项目本地 texmf 并让构建使用，不静默换字体或改系统安装。",
      "回应审稿意见时，读审稿、它读过的材料清单和当前产物，共因问题合并处理，核实依据，不全盘接受；按实质影响排序，决定接受、反驳、限定或调查，每个重要问题都覆盖。用 Source 核新引文与主张，用 Experiment 取得或解释结果；比较原主张、审稿理解、回应和改后主张，不暗改确定性、因果、范围、数量限定与新意。",
      "按要求改证据、分析、文字、图表、补充材料或投稿文件，不只改语气；局部答复解决不了就修共因。逐项说明担忧已解决、减轻还是仍有限制，写了答复不等于解决或审稿人接受。审稿原文与作者回应分开保留，并链接到改动产物；依赖旧审稿建议前，按 Review 查当前版本。"
    ],
    boundaries: [
      "只评估就只返回发现，不编辑。局部写作不因读材料就强加导师、新轮次或子代理；准备产物不等于获准投稿。作者回应与修改限于请求范围，不授权投稿或破坏性操作。"
    ]
  });
  if (slug === "figure") return capabilityContract({
    ambientParticipation: "围绕科学解释跨领域设计图，一组图先按主张分工，结果主张配读者能亲眼判断的真实输出；把参考决策落实到模型／代码、可编辑排版和实看过的导出。复用同篇视觉语言，新构图补查所缺参考；插图先用模型设计，定量图用真实数据与代码。画布随稿件宽度和内容，不套幻灯片比例；新构图直接读改 `.claude/commands/dove/figure.md` 的设计简报，不必调用命令入口。",
    purpose: "跨研究领域制作、修改、检查和配注达到发表质量的科学图。",
    when: "方法机制图、架构、定量图、比较、证据组合或视觉评估时使用。",
    actions: [
      "为论文画图时，先读 Draft 在稿件旁维护的同一张‘论点—证据—位置—尺寸’表，按其中要承担的论点、正文或补充的位置、实际栏宽和目标高度画；缺项先与 Draft 补齐，需要更大面积时先一起调整预算，不自行扩大占位或另建一张表。整套图分工看每张图支撑哪个主张、哪些证据只有它能给、哪些已由表格或正文承担，用“删掉它读者会失去什么”判断它值不值得占正文。第一张图让读者一眼看到要解决的问题，以及本文的核心结果或思路。主张涉及方法产出什么（生成、重建、编辑、预测的可见结果）时，正文要有读者能亲眼判断的真实输出：固定顺序或随机选取、不挑最好、类型多样、含失败；完成率、误差等数字留在表里，不用统计图顶替结果图。对比图里各方法用同样的输入、视角和渲染设置。机制图讲为什么有效，结果图展示是否有效，两者各司其职、不互相替代。",
      "每张图再定科学问题、读者、核心结论和证据。选择能揭示科学的表示：机制可用状态与干预，架构可用信息流，比较可对齐视图，定量结果用测量位置和不确定性；不是固定布局。有实际模板就用栏宽与制图要求，否则说明暂定宽度。按最终物理尺寸定字与线宽：印刷尺寸下字号不小于约 6–7 pt、线宽不细于约 0.5 pt，投稿方另有规定从其规定；再由内容和高度限制定画布及边距。PPT 是编辑面，不是幻灯片模板，不以默认比例或任意预设定图。",
      "分清重画和改图：用户要重画时，从那张表里的论点、证据、尺寸和参考图出发重新设计，不看也不给模型看旧图，画完再用 dove figure --compare 和旧图对照；局部修改才从现有图出发，只重看受影响的选择。新构图查真正发表、适合解释任务的图，也看可迁移的跨域例子；已有实读参考可复用，补材料缺口。提取焦点为何最大、阅读路径、跨视图身份或数量编码、对齐与共用尺度、局部连接、密度、间距、字和色。把参考选择、科学内容和材料角色综合成当前设计简报，不只列论文或泛泛风格词。首图、方法图这类重要的图，先用图像模型出两三个不同的构图方向，比较后选一个或合并各自的长处。同篇复用符号与视觉语言，并落到一份共享样式里：字号阶梯、配色及各颜色的含义、线宽和证据的渲染约定，画图代码和 PPT 都从它取。配色在色盲和灰度下也分得清：有含义的颜色同时用形状、线型或深浅区分，同一种颜色全文只表示一种含义。有用决策放现有图材料或代码，不强加独立报告、固定参考数或每次重查。",
      "组合插图先把这些设计选择填入下方模型简报，通过 dove figure --project <root> --prompt <text>（或 --prompt-file <file>）[--image <file> ...] --output <file.png>，或现有图像工具，设计整幅构图和解释性图像，再做 PPT。支持时按需加 --size、--quality、--background；模型像素大小只是工作面，不是最终比例。由中心关系决定焦点大小和细节，不默认极简几何或繁复渲染。定量图用真实数据可复现生成，认真定坐标、单位、尺度与不确定性；模型可建议布局，不能造测量。图像模型只设计构图、画示意；真实输出（渲染、网格、照片、预测结果）不让模型生成、重画或修改，模型图里出现的证据在 PPT 里一律换回原文件。纯数据图不需图像模型或 PPT 包装。",
      "实现选定设计，保留层级、阅读路径、对应关系和视觉语言，修科学错误，用真实材料换占位。真实输出按证据类型渲染到能看清要判断的结构，整套图用同一套约定：光照、材质、视角一致，颜色按含义上；三维网格默认显示边线，按部件或语义上色。局部放大从原始数据或输出重新渲染，不放大截图。嵌入的图片和证据保持原始宽高比，组合时也不拉伸或压扁。组合插图在 PPT 中分开放可替换图像／证据及原生标签、连线和有用矢量；可编辑不等于把丰富图像描成简单形状。标题、标签、数学符号、程序词各有一致角色，变量和下标沿用稿件约定。为可读性选字与间距，不逐条缩小去塞旧框；不同论文的字体、字号阶梯、配色、布局没有通用模板。图内只放简短标签，采用 Draft 的读者词表，与正文和表格里的量同名、同符号；不放限定、免责或例外，也不出现顶点编号、版本号、调试状态、内部文件名这类内部用语；图注第一句就是这张图的结论，再写怎么看，读懂所需的限定只在图注里说一次；有误差线就写清是标准差、标准误还是置信区间，以及样本数；结果样例写清是怎么选的（固定顺序或随机）。必要协议写在论文协议节或补充，开发用样本编号、原始路径和渲染记录留在非投稿的来源说明，不塞进补充图。用 dove figure --tools 找本机 python-pptx Python 与导出命令。并行不同分支用独立工作区；共用工作区时切分支前交接当前分支和未提交改动，提交前核对所在分支。写稿方负责 tex、图注与正文，出图方负责图内文字；交图时列出构图、尺寸、标注或证据变化中会影响正文的部分，供 Draft 同步；Draft 改名字、符号、子图编号或描述后，Figure 也回查图内及导出，两边改后互查，再放回稿件编译看版面。",
      "按稿件尺寸打开实际导出，对照科学解释、参考综合决策及实际用过的模型设计，不只查文件有效。先看第一眼能否看出这张图的核心结论，整套图是否各尽其职，有没有重画表格里已有的数字、却丢掉只有图能给的证据。改焦点、割裂分面、模糊对应、拥挤和小字，实看字形、数学位置与字体嵌入。图要说明的局部结构在最终栏宽下要肉眼可辨，看不清就重新取景、放大或加从原始数据重渲的局部图，不靠加文字解释；局部修不好解释就重选表示或构图，不无限抛光。整套图用 dove figure --proof --figure <文件>@<实际宽度> …（宽度取投稿模板的单栏宽和通栏宽）排进一张总览，对照字号阶梯、配色和着色方式；改图时用 dove figure --compare --before <旧图> --after <新图> --width <实际宽度> 出改前改后的对照，看过再算改完；替换旧图时，交付里说清新图比旧图好在哪、哪里还不如旧图，让用户定用哪版或怎么合并。图内文字参加 Draft 的语言与排版对照审查：失败标签、图例、方法名和 token 的措辞、字形、大小与靠近对象的关系和正文、补充一起查，列给出图方改；图方改后重新导出预览，写稿方回查图注、正文引用和同一量名称。按请求交可编辑源、素材／创建代码、图注和同源 PDF／PNG，组合图含 PPTX。导出保留随内容定的画布与比例，不拉伸证据或套幻灯片形状；直说不可用调用、复用设计和材料缺口。"
    ],
    modelPrompt: `Design a publication-quality [figure kind] for [field and audience], at [target manuscript column width; maximum height if applicable]. This is a visual design reference for editable composition, not a presentation slide.
CANVAS: [actual venue/template width and relevant artwork requirements, or a stated provisional width]. Arrange the scientific relation and supporting content at readable final-size typography, then choose height and margins from that composition. The image model's supported pixel size is only a working surface, not the final figure format; do not fit content to a slide ratio or stretch imagery to fill one.
SCIENTIFIC MESSAGE: [one takeaway and the question this figure answers].
ROLE IN THE PAPER: [the claim this figure carries, the evidence only it shows (for example real outputs readers must judge for themselves), and what tables or other figures already cover].
CONTENT: [inspected facts, entities, relationships and scientific distinctions the image must preserve].
MATERIALS: [each input's role: real evidence, explanatory illustration or visual reference, and — only for a local revision — the prior design to revise; a redraw starts from the claim and evidence without the old figure; identify what is supplied separately].
REFERENCE SYNTHESIS: [actual figures inspected or relevant prior reference decisions reused; explain what to adopt or change for this scientific task: focal scale, reading order, cross-view encoding, alignment/scales, density, close-up connections, typography and color. Turn them into a coherent design, not a list of paper names or a copy of their subject matter].
VISUAL CONTINUITY: [reader-facing names from Draft's internal-name-to-paper-term glossary, symbols and visual choices already established for this paper; use one name and symbol per quantity in prose, tables and figures; what this figure retains, changes or needs to design anew].
Choose representations that expose the central [mechanism/state change, information flow, quantitative relation, comparison or evidence structure]. Make that relation the visual focus, allocating area and detail by explanatory importance rather than equal modules. Connect overview and detail through aligned views, repeated identities, shared coordinates or explicit links where useful; a local structure the figure argues about must be clearly visible at final size, shown as a close-up re-rendered from the source rather than an enlarged crop. Integrate the reference decisions into the whole composition, not a stock arrangement with illustrations added afterward.
Use consistent visual identities and meaningful color that stays distinguishable in grayscale and for color-blind readers: where color carries meaning, pair it with shape, line style or lightness, and keep one meaning per color across the paper. Give headings, ordinary labels, mathematical symbols/subscripts and program tokens intentional roles consistent with the manuscript. Select type, line weights, spacing and contrast for final-size legibility, not to fill inherited boxes: no text below about 6–7 pt and no line thinner than about 0.5 pt at print size. Use depth, texture, shading, simple geometry or boxes where they help this explanation; no fixed font, palette, layout or minimal/rich style applies to every field.
Supplied evidence (real outputs such as renders, meshes, photos or predictions) is placed from the original files at its own aspect ratio: do not redraw, regenerate, retouch, stretch or alter it, and mark where each piece goes. Compared methods share the same inputs, viewpoints and rendering settings. Quantitative marks come from supplied data and plotting code, not invented model-rendered values; indicate where separately rendered plots belong. Make schematics recognizable as explanatory, not measured results. Inside the figure use only short labels close to their referents: no qualifications, disclaimers or exceptions, and no internal identifiers such as vertex ids, version numbers, debug states or file names. The caption states once what the figure shows, how to read it and any qualification it needs; necessary protocol details belong in the paper's protocol section or supplement; internal sample IDs, raw paths and rendering history stay in non-submission provenance notes, not the supplement. Plan separately editable labels/connectors and replaceable illustrations/evidence so the selected hierarchy, correspondence and visual language can survive implementation and be checked in the actual export.`,
    boundaries: [
      "只规划、只评估、不写入的请求保持范围；完成要科学忠实、视觉解释有效，不只是导出文件有效。"
    ]
  });
  if (slug === "review") return capabilityContract({
    ambientParticipation: "在干净只读上下文判断指定当前论文，区分独立审稿、冷读（只拿到 PDF 的第一次读者）、作者自查和交付检查。",
    purpose: "评估论文科学质量、局部产物、交付就绪或已有审稿意见。",
    when: "判断论文或检查审稿时使用，不代替导师定方向。",
    responsibilities: [
      DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
      DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY
    ],
    actions: [
      DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
      `独立审稿在全新只读上下文调用 ${DOVE_RESEARCH_REVIEW_AGENT_NAME}，给当前稿、所引结果与相关实读投稿／文献材料。它用 Read/Grep/Glob 读指定文件，不接收作者执行对话，不需冻结快照、审稿 CLI 或持久会话。这是看证据的审稿，查主张、比较和数字。`,
      "语言与排版对照审查另做，放在交付前冷读之前：调用正文以‘语言与排版对照审查’开头，附上 Draft 的逐句语言与排版检查项，给当前稿和补充的 PDF 页面（含图内文字）、相关排版源码、稿件旁 REFERENCE_LAYOUT 和其中记录的录用论文 PDF；让全新只读 dove-review 逐句逐表对照，不只看能否读懂，按影响返回页码、原文 → 可替换英文或排版改法、对应参考页码与理由，原样保存有用意见。区分参考论文惯例与个人偏好，不照抄句子、不为换说法改量名，不用润色削弱有据主张；缺材料就报告缺口。主会话交 Draft 与 Figure 处理、重编译后，再另开全新读者冷读当前 PDF，不把参考论文或对照意见带给冷读者。这一遍不替代科学审稿，冷读也不替代这一遍。",
      "冷读另做，交付前和用户要外行视角时都做：dove cold-read --project <root> --pdf <稿件.pdf> [--pdf <补充.pdf>] [--venue <投稿目标>] 把编译好的 PDF 转成逐页文字和页面图片，并输出调用正文；把正文原样交给一个全新的 dove-review，只给这份 PDF，不给 tex、读数文档或项目背景，那是开发者视角，会把注意力引到核数字上。写稿的人在项目里泡久了，查不出自己的行话，冷读不能用自查代替。冷读结果原样存到稿件旁，分成“必须改”和“可改可不改”，另列事实/数字疑点供掌握原始读数的一方核对：行话在第一次出现时定义或换成通用说法，读不懂的地方先改稿（这类问题通常不是靠解释给读者解决），防御措辞删掉或集中到局限段；冷读者建议加限定或削弱强项时按证据和扬长避短取舍，不照单全收。图表和版面问题交给 Figure 和 Draft；逐条处理必须改项，重新编译后再由全新读者冷读，直到必须改项清零才交付。",
      "返回简洁判断、阻挡问题、证据、作者可做的修改和实际读过的文件；材料不足就限定判断。整篇审稿读完整当前版，局部审查保持局部；实质修改后需重审完整新版，旧建议才可视为当前。",
      "忠实保留真实审稿返回，区分用户贴来的意见与实际完成的独立审稿。有用返回放普通项目材料，不建运行时交换库；阅读或保存本身不授权修改或重审。"
    ],
    boundaries: [
      "审稿是有理由的反对，不是实验证据或自动接受。作者判断依据并处理重要担忧；作者自查不能证明独立审稿。"
    ]
  });
  throw new Error(`Unknown Dove capability: ${slug}.`);
}

const SURFACES = [
  ["research", "选出有依据的候选供用户决定，或推进已确认主线的实质研究。"],
  ["status", "只汇报真实结果、核心证据、卡点和当前轮次，不启动新工作。"],
  ["source", "查读来源、核引文与主张，把发现用到研究决定中。"],
  ["experiment", "解释真实结果以形成方法，用公平比较、有效诊断和可靠分析检验。"],
  ["draft", "据证据写改权威稿件，也按审稿意见修改并写回应，沿实际构建或导出路径交付。"],
  ["figure", "从真实材料制图并检查，交图注、可编辑源和渲染结果。"],
  ["review", "独立审指定当前论文，或检查局部产物、交付就绪和已有意见。"]
];

export const COMMAND_SURFACES = SURFACES.map(([slug, summary]) => ({
  id: `dove.${slug}`,
  title: `Dove ${slug}`,
  summary,
  contract: contract(slug),
  examples: [`/dove:${slug}`]
}));
export const COMMAND_SURFACE_BY_ID = Object.fromEntries(COMMAND_SURFACES.map((item) => [item.id, item]));

export function renderDoveAmbientParticipationSection() {
  return `## 能力参与

这些方法可直接用于普通主会话，命令只是快捷入口，不是前提。主会话始终保留科研判断，子代理只做明确的具体活。

${COMMAND_SURFACES.map((command) => `- ${command.title}: ${command.contract.ambientParticipation}`).join("\n")}`;
}

export function commandIdToSlug(commandId) { return commandId.replace(/^dove\./u, ""); }
export function hostCommandSlug(commandId) { return commandIdToSlug(commandId).replace(/\./gu, "-"); }
export function adapterPathForCommand(hostId, command) {
  const commandId = typeof command === "string" ? command : command.id;
  const slug = hostCommandSlug(commandId);
  if (hostId === "claude") return `.claude/commands/dove/${slug}.md`;
  throw new Error(`Unknown host adapter: ${hostId}`);
}
export function commandAdapterPathsForHost(hostId) { return COMMAND_SURFACES.map((command) => adapterPathForCommand(hostId, command)); }
export function allGeneratedCommandAdapterPaths() { return PROJECT_HOST_IDS.flatMap(commandAdapterPathsForHost); }
export const HOST_ADAPTERS = Object.fromEntries(PROJECT_HOST_IDS.map((hostId) => {
  const paths = [...commandAdapterPathsForHost(hostId), ...DOVE_CLAUDE_AMBIENT_PROJECT_PATHS];
  return [hostId, { label: HOST_DEFINITIONS[hostId].label, paths, requiredPaths: paths, jsonChecks: HOST_DEFINITIONS[hostId].jsonChecks }];
}));
export const CURRENT_MANAGED_PATHS = Object.freeze({
  core: Object.freeze([...PACKAGE_RUNTIME_PATHS]),
  claude: Object.freeze([...HOST_ADAPTERS.claude.paths])
});
export function packageResourcePath(hostId, destinationPath) {
  return `${PACKAGE_RESOURCE_ROOT}/${hostId}/${destinationPath}`;
}
export const MANAGED_PACKAGE_PATHS = Object.freeze([
  ...commandAdapterPathsForHost("claude").map((item) => packageResourcePath("claude", item)),
  ...PACKAGE_GENERATED_SUPPORT_PATHS,
  ...CURRENT_MANAGED_PATHS.core,
  ...PACKAGE_BRAND_PATHS,
  ...PACKAGE_DOCUMENTATION_PATHS
]);
