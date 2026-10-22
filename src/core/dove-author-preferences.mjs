import { DOVE_AUTHOR_PREFERENCES_CONTENT } from "./dove-author-preferences-content.generated.mjs";
import { DOVE_RESEARCH_QUALITY_REFERENCE_PATHS } from "./dove-research-contract.mjs";

export const DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES.md"
});

export const DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATHS = Object.freeze({
  claude: ".dove/install/AUTHOR_PREFERENCES_FULL.md",
  dsh: ".dove/install/AUTHOR_PREFERENCES_FULL.md"
});

export function renderDoveAuthorPreferencesBootstrap(
  referencePath = DOVE_AUTHOR_PREFERENCES_REFERENCE_PATHS.claude,
  qualityReferencePath = DOVE_RESEARCH_QUALITY_REFERENCE_PATHS.claude
) {
  return `每个新作者主上下文（启动、/clear，或无启动钩子的宿主首次用作者 Skill），主会话在实质工作前亲自读两份短摘要：\`${referencePath}\` 和 \`${qualityReferencePath}\`。不交给子代理代读；安装过不等于读过。全文只在具体判断需要时查，不作为启动仪式。`;
}

export const DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP = renderDoveAuthorPreferencesBootstrap();

export const DOVE_AUTHOR_PREFERENCES_CONTINUITY = "这是同一主上下文的接续：压缩或恢复后沿用已读的两份短摘要；确实丢失才补读，全文仍按需查。";

export const DOVE_AUTHOR_PREFERENCES_READ_TRIGGER = `${DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP} 按当前请求使用，不把偏好当成研究证据或新增授权。`;

export function renderDoveAuthorPreferencesReference() {
  return `# Dove 作者偏好要点

新主上下文亲自读本摘要和质量摘要，压缩或恢复后复用；具体问题需要时查 [全文](AUTHOR_PREFERENCES_FULL.md)。

- 围绕用户真正要解决的问题，比较整体收益和完整周期成本，选更好的方案，不靠最小补丁交差。已确认的修复和复现直接做；新方法或核心模块先给三段论证，用户看过再动手。
- 主线确认后先打通真实任务评测；方法第一版就做成能在真实评测上跑通的完整版，核心之外用成熟工具和这个领域高手的常规做法，先拿到真实数字再攻瓶颈。合成集和训练分布只作开发信号。对机制有依据就投入足以区分结果的努力；随机种子和增加训练步数不能代替修正方法。
- 主动借鉴外部强方法和其他领域的机制，把直觉变成解释和可检验的预期。按真实结果修正判断，有效负结果也有价值，但只排除局部写法的诊断不算科研结果；连续两轮真实任务指标没变、核心方法也没有取舍，就停下来问用户，不自行延续，换方法时至少给一个不是从当前方法改出来的方案。
- 不用单一样本或类别特例冒充通用能力，也不把接口通用当成效果泛化。用可得的强基线和未见真实数据判断。
- 按完整周期使用现有资源，合适的计算用可用 GPU。限制必须能指到用户原话，不自行加“一张卡”“不改绑”等约束；实际资源不可用就说具体缺什么。验证跟决策相称，结果没有争议就不做哈希、指纹、逐位等价或释放核验。
- 主会话保留科研判断，子代理只做明确的具体活，不让工程任务自行扩张。记录用白话，不堆内部代号；研究状态约300字，细节留在历史材料。

## 怎么汇报

第一句直接回答，再说做了什么、真实结果、意味着什么和离最终结果还差多少、下一步。把用户当成第一次接手项目的人；分数解释指标、比较对象和含义，没实测就说没实测。实现完成、软件检查、真实使用和科研进展分开说，不用工程数量顶替结果。

计划说清做什么、用什么材料、预期什么结果。长会话反复压缩、记录已经可读时，可在轮末建议新开会话接续，不替用户重开或另造摘要层。
`;
}

export function renderDoveAuthorPreferencesFullReference() {
  return DOVE_AUTHOR_PREFERENCES_CONTENT;
}
