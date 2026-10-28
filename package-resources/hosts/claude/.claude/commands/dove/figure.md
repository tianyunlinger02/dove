---
description: "从真实材料制图并检查，交图注、可编辑源和渲染结果。"
argument-hint: "可选：请求、产物路径、投稿目标、约束或后续背景"
---

# dove.figure

从真实材料制图并检查，交图注、可编辑源和渲染结果。

## 当前请求

$ARGUMENTS

## 示例

- `/dove:figure`

## 怎么做

按当前问题使用这些做法，不机械套步骤或报告模板；明确需要用户决定的地方仍先交给用户。

### 用途

跨研究领域制作、修改、检查和配注达到发表质量的科学图。

### 适用情况

方法机制图、架构、定量图、比较、证据组合或视觉评估时使用。

### 工作范围

- 只规划、只评估、不写入的请求保持范围；完成要科学忠实、视觉解释有效，不只是导出文件有效。

### 具体做法

- 为论文画图时，先读 Draft 在稿件旁维护的同一张‘论点—证据—位置—尺寸’表，按其中要承担的论点、正文或补充的位置、实际栏宽和目标高度画；缺项先与 Draft 补齐，需要更大面积时先一起调整预算，不自行扩大占位或另建一张表。整套图分工看每张图支撑哪个主张、哪些证据只有它能给、哪些已由表格或正文承担，用“删掉它读者会失去什么”判断它值不值得占正文。第一张图让读者一眼看到要解决的问题，以及本文的核心结果或思路。主张涉及方法产出什么（生成、重建、编辑、预测的可见结果）时，正文要有读者能亲眼判断的真实输出：固定顺序或随机选取、不挑最好、类型多样、含失败；完成率、误差等数字留在表里，不用统计图顶替结果图。对比图里各方法用同样的输入、视角和渲染设置。机制图讲为什么有效，结果图展示是否有效，两者各司其职、不互相替代。
- 方法本身含后处理时，对比、编辑和条件生成等效果图默认展示该方法真实的最终后处理输出；结构、裁片域和连接性图保留能说明机制的原始网格，不把所有图都画成线框。展示阶段、样本集合和主表对应行一致，缺该阶段读数交 Experiment 补核，原始结果可在补充作对照；不能后处理的输出如实显示并说明，不悄悄省略或伪造。细分、松弛等须来自真实方法流程，不是为好看修图；颜色标示或‘逐点不变’只在后处理前成立时，正文与图注明确其阶段，不把前阶段性质写成最终几何性质。
- 每张图再定科学问题、读者、核心结论和证据。选择能揭示科学的表示：机制可用状态与干预，架构可用信息流，比较可对齐视图，定量结果用测量位置和不确定性；不是固定布局。有实际模板就用栏宽与制图要求，否则说明暂定宽度。按最终物理尺寸定字与线宽：印刷尺寸下字号不小于约 6–7 pt、线宽不细于约 0.5 pt，投稿方另有规定从其规定；再由内容和高度限制定画布及边距。PPT 是编辑面，不是幻灯片模板，不以默认比例或任意预设定图。
- 分清重画和改图：用户要重画时，从那张表里的论点、证据、尺寸和参考图出发重新设计，不看也不给模型看旧图，画完再用 dove figure --compare 和旧图对照；局部修改才从现有图出发，只重看受影响的选择。新构图查真正发表、适合解释任务的图，也看可迁移的跨域例子；已有实读参考可复用，补材料缺口。提取焦点为何最大、阅读路径、跨视图身份或数量编码、对齐与共用尺度、局部连接、密度、间距、字和色。把参考选择、科学内容和材料角色综合成当前设计简报，不只列论文或泛泛风格词。首图、方法图这类重要的图，先用图像模型出两三个不同的构图方向，比较后选一个或合并各自的长处。同篇复用符号与视觉语言，并落到一份共享样式里：字号阶梯、配色及各颜色的含义、线宽和证据的渲染约定，画图代码和 PPT 都从它取。配色在色盲和灰度下也分得清：有含义的颜色同时用形状、线型或深浅区分，同一种颜色全文只表示一种含义。有用决策放现有图材料或代码，不强加独立报告、固定参考数或每次重查。
- 组合插图先把这些设计选择填入下方模型简报，通过 dove figure --project <root> --prompt <text>（或 --prompt-file <file>）[--image <file> ...] --output <file.png>，或现有图像工具，设计整幅构图和解释性图像，再做 PPT。支持时按需加 --size、--quality、--background；模型像素大小只是工作面，不是最终比例。由中心关系决定焦点大小和细节，不默认极简几何或繁复渲染。定量图用真实数据可复现生成，认真定坐标、单位、尺度与不确定性；模型可建议布局，不能造测量。图像模型只设计构图、画示意；真实输出（渲染、网格、照片、预测结果）不让模型生成、重画或修改，模型图里出现的证据在 PPT 里一律换回原文件。纯数据图不需图像模型或 PPT 包装。
- 实现选定设计，保留层级、阅读路径、对应关系和视觉语言，修科学错误，用真实材料换占位。真实输出按证据类型渲染到能看清要判断的结构，整套图用同一套约定：光照、材质、视角一致，颜色按含义上；结构与拓扑图的三维网格默认显示边线、按部件或语义上色；效果展示可对真实最终输出平滑着色、去线框，不改变几何证据。局部放大从原始数据或输出重新渲染，不放大截图。嵌入的图片和证据保持原始宽高比，组合时也不拉伸或压扁。组合插图在 PPT 中分开放可替换图像／证据及原生标签、连线和有用矢量；可编辑不等于把丰富图像描成简单形状。标题、标签、数学符号、程序词各有一致角色，变量和下标沿用稿件约定。为可读性选字与间距，不逐条缩小去塞旧框；不同论文的字体、字号阶梯、配色、布局没有通用模板。图内只放简短标签，不贴完成率等统计数或重复图注，采用 Draft 的读者词表，与正文和表格里的量同名、同符号；不放限定、免责或例外，也不出现顶点编号、版本号、调试状态、内部文件名这类内部用语；图注用短结论标题，或短主题标题接一句结论，再写怎么看与必要记号，不在标题堆集合、面数、n= 或模型规模。默认选样、匹配和展示阶段在 Setup 说一次，图注只补该图的差异及读懂所需限定，不隐藏会误导的处理阶段；有误差线就写清是标准差、标准误还是置信区间，以及样本数。必要协议写在论文协议节或补充，开发用样本编号、原始路径和渲染记录留在非投稿的来源说明，不塞进补充图。用 dove figure --tools 找本机 python-pptx Python 与导出命令。并行不同分支用独立工作区；共用工作区时切分支前交接当前分支和未提交改动，提交前核对所在分支。写稿方负责 tex、图注与正文，出图方负责图内文字；交图时列出构图、尺寸、标注或证据变化中会影响正文的部分，供 Draft 同步；Draft 改名字、符号、子图编号或描述后，Figure 也回查图内及导出，两边改后互查，再放回稿件编译看版面。
- 按稿件尺寸打开实际导出，对照科学解释、参考综合决策及实际用过的模型设计，不只查文件有效。先看第一眼能否看出这张图的核心结论，整套图是否各尽其职，有没有重画表格里已有的数字、却丢掉只有图能给的证据。改焦点、割裂分面、模糊对应、拥挤和小字，实看字形、数学位置与字体嵌入。图要说明的局部结构在最终栏宽下要肉眼可辨，看不清就重新取景、放大或加从原始数据重渲的局部图，不靠加文字解释；局部修不好解释就重选表示或构图，不无限抛光。整套图用 dove figure --proof --figure <文件>@<实际宽度> …（宽度取投稿模板的单栏宽和通栏宽）排进一张总览，对照字号阶梯、配色和着色方式；改图时用 dove figure --compare --before <旧图> --after <新图> --width <实际宽度> 出改前改后的对照，看过再算改完；替换旧图时，交付里说清新图比旧图好在哪、哪里还不如旧图，让用户定用哪版或怎么合并。图内文字参加 Draft 的语言与排版对照审查：失败标签、图例、方法名和 token 的措辞、字形、大小与靠近对象的关系和正文、补充一起查，列给出图方改；图方改后重新导出预览，写稿方回查图注、正文引用和同一量名称。按请求交可编辑源、素材／创建代码、图注和同源 PDF／PNG，组合图含 PPTX。导出保留随内容定的画布与比例，不拉伸证据或套幻灯片形状；直说不可用调用、复用设计和材料缺口。

### 可调整的模型提示

按本次科学内容和参考填入相关项，不把它当固定布局或画风。

```text
Design a publication-quality [figure kind] for [field and audience], at [target manuscript column width; maximum height if applicable]. This is a visual design reference for editable composition, not a presentation slide.
CANVAS: [actual venue/template width and relevant artwork requirements, or a stated provisional width]. Arrange the scientific relation and supporting content at readable final-size typography, then choose height and margins from that composition. The image model's supported pixel size is only a working surface, not the final figure format; do not fit content to a slide ratio or stretch imagery to fill one.
SCIENTIFIC MESSAGE: [one takeaway and the question this figure answers].
ROLE IN THE PAPER: [the claim this figure carries, the evidence only it shows (for example real outputs readers must judge for themselves), and what tables or other figures already cover].
CONTENT: [inspected facts, entities, relationships and scientific distinctions the image must preserve].
MATERIALS: [each input's role: real evidence, explanatory illustration or visual reference; for real outputs identify the actual raw/final post-processing stage and matching table row/sample set; and — only for a local revision — the prior design to revise; a redraw starts from the claim and evidence without the old figure; identify what is supplied separately].
REFERENCE SYNTHESIS: [actual figures inspected or relevant prior reference decisions reused; explain what to adopt or change for this scientific task: focal scale, reading order, cross-view encoding, alignment/scales, density, close-up connections, typography and color. Turn them into a coherent design, not a list of paper names or a copy of their subject matter].
VISUAL CONTINUITY: [reader-facing names from Draft's internal-name-to-paper-term glossary, symbols and visual choices already established for this paper; use one name and symbol per quantity in prose, tables and figures; what this figure retains, changes or needs to design anew].
Choose representations that expose the central [mechanism/state change, information flow, quantitative relation, comparison or evidence structure]. Make that relation the visual focus, allocating area and detail by explanatory importance rather than equal modules. Connect overview and detail through aligned views, repeated identities, shared coordinates or explicit links where useful; a local structure the figure argues about must be clearly visible at final size, shown as a close-up re-rendered from the source rather than an enlarged crop. Integrate the reference decisions into the whole composition, not a stock arrangement with illustrations added afterward.
Use consistent visual identities and meaningful color that stays distinguishable in grayscale and for color-blind readers: where color carries meaning, pair it with shape, line style or lightness, and keep one meaning per color across the paper. Give headings, ordinary labels, mathematical symbols/subscripts and program tokens intentional roles consistent with the manuscript. Select type, line weights, spacing and contrast for final-size legibility, not to fill inherited boxes: no text below about 6–7 pt and no line thinner than about 0.5 pt at print size. Use depth, texture, shading, simple geometry or boxes where they help this explanation; no fixed font, palette, layout or minimal/rich style applies to every field.
Supplied evidence (real outputs such as renders, meshes, photos or predictions) is placed from the original files at its own aspect ratio: do not redraw, regenerate, retouch, stretch or alter it, and mark where each piece goes. Compared methods share the same inputs, viewpoints and rendering settings. Quantitative marks come from supplied data and plotting code, not invented model-rendered values; indicate where separately rendered plots belong. Make schematics recognizable as explanatory, not measured results. Inside the figure use only short labels close to their referents, not completion statistics or duplicated caption text: no qualifications, disclaimers or exceptions, and no internal identifiers such as vertex ids, version numbers, debug states or file names. The caption starts with a short takeaway or topic followed by the finding, then explains how to read it and any qualification it needs. Default sample selection, matching and display-stage protocols are stated once in Setup; captions retain figure-specific differences and any processing-stage distinction needed to avoid misleading the reader. Other protocol details belong in the paper's protocol section or supplement; internal sample IDs, raw paths and rendering history stay in non-submission provenance notes, not the supplement. Plan separately editable labels/connectors and replaceable illustrations/evidence so the selected hierarchy, correspondence and visual language can survive implementation and be checked in the actual export.
```
