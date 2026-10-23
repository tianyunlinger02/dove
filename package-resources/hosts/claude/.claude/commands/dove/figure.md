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

- 为一篇论文画一组图时，先给整套图分工：每张图支撑哪个主张，哪些证据只有它能给，哪些已由表格或正文承担；按投稿页数决定放正文还是补充，用“删掉它读者会失去什么”判断它值不值得占正文。主张涉及方法产出什么（生成、重建、编辑、预测的可见结果）时，正文要有读者能亲眼判断的真实输出：固定顺序或随机选取、不挑最好、类型多样、含失败；完成率、误差等数字留在表里，不用统计图顶替结果图。机制图讲为什么有效，结果图展示是否有效，两者各司其职、不互相替代。
- 每张图再定科学问题、读者、核心结论和证据。选择能揭示科学的表示：机制可用状态与干预，架构可用信息流，比较可对齐视图，定量结果用测量位置和不确定性；不是固定布局。有实际模板就用栏宽与制图要求，否则说明暂定宽度。按最终物理尺寸定字与线宽，再由内容和高度限制定画布及边距。PPT 是编辑面，不是幻灯片模板，不以默认比例或任意预设定图。
- 新构图查真正发表、适合解释任务的图，也看可迁移的跨域例子；已有实读参考可复用，补材料缺口。提取焦点为何最大、阅读路径、跨视图身份或数量编码、对齐与共用尺度、局部连接、密度、间距、字和色。把参考选择、科学内容和材料角色综合成当前设计简报，不只列论文或泛泛风格词。同篇复用符号与视觉语言，局部修改只重看受影响选择；有用决策放现有图材料或代码，不强加独立报告、固定参考数或每次重查。
- 组合插图先把这些设计选择填入下方模型简报，通过 dove figure --project <root> --prompt <text>（或 --prompt-file <file>）[--image <file> ...] --output <file.png>，或现有图像工具，设计整幅构图和解释性图像，再做 PPT。支持时按需加 --size、--quality、--background；模型像素大小只是工作面，不是最终比例。由中心关系决定焦点大小和细节，不默认极简几何或繁复渲染。定量图用真实数据可复现生成，认真定坐标、单位、尺度与不确定性；模型可建议布局，不能造测量。纯数据图不需图像模型或 PPT 包装。
- 实现选定设计，保留层级、阅读路径、对应关系和视觉语言，修科学错误，用真实材料换占位。组合插图在 PPT 中分开放可替换图像／证据及原生标签、连线和有用矢量；可编辑不等于把丰富图像描成简单形状。标题、标签、数学符号、程序词各有一致角色，变量和下标沿用稿件约定。为可读性选字与间距，不逐条缩小去塞旧框；字体、字号阶梯、配色、布局无通用模板。图内标签简短；正文图注写这张图回答什么、怎么看，以及读懂它必需的条件，协议细节、样本编号和渲染记录放补充材料或图的来源说明。用 dove figure --tools 找本机 python-pptx Python 与导出命令。
- 按稿件尺寸打开实际导出，对照科学解释、参考综合决策及实际用过的模型设计，不只查文件有效。先看第一眼能否看出这张图的核心结论，整套图是否各尽其职，有没有重画表格里已有的数字、却丢掉只有图能给的证据。改焦点、割裂分面、模糊对应、拥挤和小字，实看字形、数学位置与字体嵌入；局部修不好解释就重选表示或构图，不无限抛光。按请求交可编辑源、素材／创建代码、图注和同源 PDF／PNG，组合图含 PPTX。导出保留随内容定的画布与比例，不拉伸证据或套幻灯片形状；直说不可用调用、复用设计和材料缺口。

### 可调整的模型提示

按本次科学内容和参考填入相关项，不把它当固定布局或画风。

```text
Design a publication-quality [figure kind] for [field and audience], at [target manuscript column width; maximum height if applicable]. This is a visual design reference for editable composition, not a presentation slide.
CANVAS: [actual venue/template width and relevant artwork requirements, or a stated provisional width]. Arrange the scientific relation and supporting content at readable final-size typography, then choose height and margins from that composition. The image model's supported pixel size is only a working surface, not the final figure format; do not fit content to a slide ratio or stretch imagery to fill one.
SCIENTIFIC MESSAGE: [one takeaway and the question this figure answers].
ROLE IN THE PAPER: [the claim this figure carries, the evidence only it shows (for example real outputs readers must judge for themselves), and what tables or other figures already cover].
CONTENT: [inspected facts, entities, relationships and scientific distinctions the image must preserve].
MATERIALS: [each input's role: real evidence, explanatory illustration, prior design to revise, or visual reference; identify what is supplied separately].
REFERENCE SYNTHESIS: [actual figures inspected or relevant prior reference decisions reused; explain what to adopt or change for this scientific task: focal scale, reading order, cross-view encoding, alignment/scales, density, close-up connections, typography and color. Turn them into a coherent design, not a list of paper names or a copy of their subject matter].
VISUAL CONTINUITY: [notation and visual choices already established for this paper; what this figure retains, changes or needs to design anew].
Choose representations that expose the central [mechanism/state change, information flow, quantitative relation, comparison or evidence structure]. Make that relation the visual focus, allocating area and detail by explanatory importance rather than equal modules. Connect overview and detail through aligned views, repeated identities, shared coordinates or explicit links where useful. Integrate the reference decisions into the whole composition, not a stock arrangement with illustrations added afterward.
Use consistent visual identities and meaningful color. Give headings, ordinary labels, mathematical symbols/subscripts and program tokens intentional roles consistent with the manuscript. Select type, line weights, spacing and contrast for final-size legibility, not to fill inherited boxes. Use depth, texture, shading, simple geometry or boxes where they help this explanation; no fixed font, palette, layout or minimal/rich style applies to every field.
Preserve supplied evidence and its identity for separate placement. Quantitative marks come from supplied data and plotting code, not invented model-rendered values; indicate where separately rendered plots belong. Make schematics recognizable as explanatory, not measured results. Keep labels concise and close to their referents; the caption says what the figure shows and how to read it, while protocol details and sample identities belong in supplementary material. Plan separately editable labels/connectors and replaceable illustrations/evidence so the selected hierarchy, correspondence and visual language can survive implementation and be checked in the actual export.
```
