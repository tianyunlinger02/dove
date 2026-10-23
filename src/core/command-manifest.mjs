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
      "主线确认后按操作说明的六个时刻推进：先搭真实评测；新方法动手前交方法设计；每轮开头写清对准、见分晓和规模，结尾写判定和改变了什么判断；超时或停滞时回答追问并停下来问用户。用 Experiment 区分开发诊断和正式比较，修评价后恢复必要可比性。",
      "接续时先看身份卡、EVAL 开头的主指标和八维走势、本轮说明和导师笔记里被否掉的方法，再决定下一步做什么。"
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
      "读 IDENTITY.md、EVAL.md 开头的主指标和八维走势、最近几行方法版本和本轮说明，先直接回答用户，再说做了什么、真实结果、意味着什么和离最终结果还差多少、下一步。说明核心能力是否证实、卡在哪里，以及本轮对准哪一维、哪天见分晓；数字解释含义，缺证据留未知。"
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
      "跨领域按相同贡献粒度找真实近邻，选题时按选题标准；查决定性重合，也用发现形成机制、候选和对照，不只扣创新。落实到设计或主张，继续检索已不会改变决定就停。",
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
      "解释结果前查相关代码、数据、配置、输出与分析。按研究标准的“从问题到方法”，找出计算在哪一步没满足任务要求，由解释推出改法和预期；新方法或新核心模块先交方法设计让用户看过。模型学不会时，可用单例过拟合诊断学习机制，不先靠更多数据或更大评价器补救；诊断只回答它实际检验的问题。",
      "规模、对照和判定按操作说明的“每轮开始”“每轮结束”：先算预期差别和噪声再定规模，互不依赖的方案同时试。开发保留代码与诊断记录，按关键未知选测试，不要求每次修改全评；但每轮的方法结果要有真实评测数字，训练或合成分布不能替代。",
      "完整任务对强同输入外部方法判断效用，消融和受控比较判断归因。预算、不确定性及失败、缺失、无效输出怎么算都写清；正式比较按研究标准“证据与实验”的协议执行，未测效果留未知，新版不继承旧版通过结论。",
      "主执行者修评价并立即标受影响结果；先复用原始输出，恢复当前主张、必要历史比较和强基线的可比性，再重跑必要版本。不用于当前判断的旧结果可标旧协议历史，用前再恢复，不要求先重跑全部历史，不混协议、不藏负证据。只修协议不等于换方法版本；若改变目标含义就问用户。"
    ],
    boundaries: [
      "只读或只设计不执行；用于调参的保留集不再是独立最终证据。"
    ]
  });
  if (slug === "draft") return capabilityContract({
    ambientParticipation: "在权威稿件中据证据写作，也按审稿意见修改并写作者回应，落实到检查过的实际产物。",
    purpose: "写作、评估或修改指定稿件、章节或承载主张的产物，也包括按审稿意见修改和写作者回应。",
    when: "用户要求写改，论证、表达、交付产物需要处理，或要回应、落实审稿意见时使用。",
    actions: [
      "读目标文本与主张证据，连清问题、缺口、洞见、方法、证据和边界，保留确定性、因果、范围、数量限定和新意。证据要求改主张时先说明；处理范围内的来源、方法、证据或图缺口，不只弱化文字，文笔好不等于贡献成立。",
      "用 `.dove/research/papers/library.json` 和 `library.md` 按方向组织相关工作，据 `papers/<id>.md` 核主张支持。引用或导出 BibTeX 前用 Source 核元数据，只导已核字段，不编作者、场合、日期或标识。显式积累或后续 watch 才更新库，只读不写。",
      "用清楚可发表的语言写发现、设置和限制；缺材料问作者，不把‘未提供’塞进稿件。在准确和投稿规范内参考可靠作者样稿，检查整篇论证影响，不把局部写作扩成新研究。",
      DOVE_RESEARCH_AUTHORITATIVE_MANUSCRIPT_BOUNDARY,
      "修改走实际构建／导出路径，看过输出才称当前稿。编译页检查溢出框、未定义引用、图表编号和位置、双栏宽表是否通栏；正文字数从源码算，排除表格、图注和参考文献，与目标核对；按投稿要求核对正文页数（含图表），超出时先在正文与补充材料之间重新分配图表和内容，保持最终字号和关键证据。修范围内问题，说明剩余材料限制。",
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
      "为一篇论文画一组图时，先给整套图分工：每张图支撑哪个主张，哪些证据只有它能给，哪些已由表格或正文承担；按投稿页数决定放正文还是补充，用“删掉它读者会失去什么”判断它值不值得占正文。主张涉及方法产出什么（生成、重建、编辑、预测的可见结果）时，正文要有读者能亲眼判断的真实输出：固定顺序或随机选取、不挑最好、类型多样、含失败；完成率、误差等数字留在表里，不用统计图顶替结果图。机制图讲为什么有效，结果图展示是否有效，两者各司其职、不互相替代。",
      "每张图再定科学问题、读者、核心结论和证据。选择能揭示科学的表示：机制可用状态与干预，架构可用信息流，比较可对齐视图，定量结果用测量位置和不确定性；不是固定布局。有实际模板就用栏宽与制图要求，否则说明暂定宽度。按最终物理尺寸定字与线宽，再由内容和高度限制定画布及边距。PPT 是编辑面，不是幻灯片模板，不以默认比例或任意预设定图。",
      "新构图查真正发表、适合解释任务的图，也看可迁移的跨域例子；已有实读参考可复用，补材料缺口。提取焦点为何最大、阅读路径、跨视图身份或数量编码、对齐与共用尺度、局部连接、密度、间距、字和色。把参考选择、科学内容和材料角色综合成当前设计简报，不只列论文或泛泛风格词。同篇复用符号与视觉语言，局部修改只重看受影响选择；有用决策放现有图材料或代码，不强加独立报告、固定参考数或每次重查。",
      "组合插图先把这些设计选择填入下方模型简报，通过 dove figure --project <root> --prompt <text>（或 --prompt-file <file>）[--image <file> ...] --output <file.png>，或现有图像工具，设计整幅构图和解释性图像，再做 PPT。支持时按需加 --size、--quality、--background；模型像素大小只是工作面，不是最终比例。由中心关系决定焦点大小和细节，不默认极简几何或繁复渲染。定量图用真实数据可复现生成，认真定坐标、单位、尺度与不确定性；模型可建议布局，不能造测量。纯数据图不需图像模型或 PPT 包装。",
      "实现选定设计，保留层级、阅读路径、对应关系和视觉语言，修科学错误，用真实材料换占位。组合插图在 PPT 中分开放可替换图像／证据及原生标签、连线和有用矢量；可编辑不等于把丰富图像描成简单形状。标题、标签、数学符号、程序词各有一致角色，变量和下标沿用稿件约定。为可读性选字与间距，不逐条缩小去塞旧框；字体、字号阶梯、配色、布局无通用模板。图内标签简短；正文图注写这张图回答什么、怎么看，以及读懂它必需的条件，协议细节、样本编号和渲染记录放补充材料或图的来源说明。用 dove figure --tools 找本机 python-pptx Python 与导出命令。",
      "按稿件尺寸打开实际导出，对照科学解释、参考综合决策及实际用过的模型设计，不只查文件有效。先看第一眼能否看出这张图的核心结论，整套图是否各尽其职，有没有重画表格里已有的数字、却丢掉只有图能给的证据。改焦点、割裂分面、模糊对应、拥挤和小字，实看字形、数学位置与字体嵌入；局部修不好解释就重选表示或构图，不无限抛光。按请求交可编辑源、素材／创建代码、图注和同源 PDF／PNG，组合图含 PPTX。导出保留随内容定的画布与比例，不拉伸证据或套幻灯片形状；直说不可用调用、复用设计和材料缺口。"
    ],
    modelPrompt: `Design a publication-quality [figure kind] for [field and audience], at [target manuscript column width; maximum height if applicable]. This is a visual design reference for editable composition, not a presentation slide.
CANVAS: [actual venue/template width and relevant artwork requirements, or a stated provisional width]. Arrange the scientific relation and supporting content at readable final-size typography, then choose height and margins from that composition. The image model's supported pixel size is only a working surface, not the final figure format; do not fit content to a slide ratio or stretch imagery to fill one.
SCIENTIFIC MESSAGE: [one takeaway and the question this figure answers].
ROLE IN THE PAPER: [the claim this figure carries, the evidence only it shows (for example real outputs readers must judge for themselves), and what tables or other figures already cover].
CONTENT: [inspected facts, entities, relationships and scientific distinctions the image must preserve].
MATERIALS: [each input's role: real evidence, explanatory illustration, prior design to revise, or visual reference; identify what is supplied separately].
REFERENCE SYNTHESIS: [actual figures inspected or relevant prior reference decisions reused; explain what to adopt or change for this scientific task: focal scale, reading order, cross-view encoding, alignment/scales, density, close-up connections, typography and color. Turn them into a coherent design, not a list of paper names or a copy of their subject matter].
VISUAL CONTINUITY: [notation and visual choices already established for this paper; what this figure retains, changes or needs to design anew].
Choose representations that expose the central [mechanism/state change, information flow, quantitative relation, comparison or evidence structure]. Make that relation the visual focus, allocating area and detail by explanatory importance rather than equal modules. Connect overview and detail through aligned views, repeated identities, shared coordinates or explicit links where useful. Integrate the reference decisions into the whole composition, not a stock arrangement with illustrations added afterward.
Use consistent visual identities and meaningful color. Give headings, ordinary labels, mathematical symbols/subscripts and program tokens intentional roles consistent with the manuscript. Select type, line weights, spacing and contrast for final-size legibility, not to fill inherited boxes. Use depth, texture, shading, simple geometry or boxes where they help this explanation; no fixed font, palette, layout or minimal/rich style applies to every field.
Preserve supplied evidence and its identity for separate placement. Quantitative marks come from supplied data and plotting code, not invented model-rendered values; indicate where separately rendered plots belong. Make schematics recognizable as explanatory, not measured results. Keep labels concise and close to their referents; the caption says what the figure shows and how to read it, while protocol details and sample identities belong in supplementary material. Plan separately editable labels/connectors and replaceable illustrations/evidence so the selected hierarchy, correspondence and visual language can survive implementation and be checked in the actual export.`,
    boundaries: [
      "只规划、只评估、不写入的请求保持范围；完成要科学忠实、视觉解释有效，不只是导出文件有效。"
    ]
  });
  if (slug === "review") return capabilityContract({
    ambientParticipation: "在干净只读上下文判断指定当前论文，区分独立审稿、作者自查和交付检查。",
    purpose: "评估论文科学质量、局部产物、交付就绪或已有审稿意见。",
    when: "判断论文或检查审稿时使用，不代替导师定方向。",
    responsibilities: [
      DOVE_RESEARCH_REVIEW_DIRECT_SCIENTIFIC,
      DOVE_RESEARCH_REVIEW_CONDITIONAL_DELIVERY
    ],
    actions: [
      DOVE_RESEARCH_REVIEW_FOUR_QUESTIONS,
      `独立审稿在全新只读上下文调用 ${DOVE_RESEARCH_REVIEW_AGENT_NAME}，给当前稿、所引结果与相关实读投稿／文献材料。它用 Read/Grep/Glob 读指定文件，不接收作者执行对话，不需冻结快照、审稿 CLI 或持久会话。`,
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
