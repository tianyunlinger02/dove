import { DOVE_AUTHOR_PREFERENCES_CONTENT } from "./dove-author-preferences-content.generated.mjs";

export const DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH = ".dove/install/AUTHOR_PREFERENCES.md";
export const DOVE_AUTHOR_PREFERENCES_FULL_REFERENCE_PATH = ".dove/install/AUTHOR_PREFERENCES_FULL.md";

// 用户对所有项目都适用、反复说过的原话（原文与日期取自各项目的原话汇总）。
// 每条附“所以怎么做”；Dove 的 Stop 追问按 id 引用其中几句。
export const DOVE_USER_SAYINGS = Object.freeze([
  Object.freeze({ id: "plain", date: "10-17", quote: "说人话，汇报的时候把我当成第一次接手这个项目", so: "第一句直接回答；先讲事，再讲术语；数字要说清是什么指标、和谁比。" }),
  Object.freeze({ id: "method-first", date: "10-19", quote: "你得先回答我我们要解决什么问题，现有方法为什么不好，我们又想提出什么解决方法", so: "做新方法之前，先把方法设计交给我看。" }),
  Object.freeze({ id: "no-substitution", date: "10-21", quote: "是要真正能解决我们的主线目标和问题哦，不要待会等价成解决其他问题，但是主问题没有解决", so: "换成子问题或代理指标之前，先说清它怎么改善原问题、能改善多少；进展按原问题来算。" }),
  Object.freeze({ id: "fastest", date: "10-11", quote: "别给自己设那麽多工程上的先后限制，主要是为了怎样最优最快的达到最终目的", so: "先在真实评测上跑通完整的第一版，再去攻瓶颈。" }),
  Object.freeze({ id: "no-tiny", date: "10-13", quote: "小规模验证如果没有用那就不要一直小规模……你做小规模的意义在哪里呢", so: "先算清预期差别和噪声，再定规模；分不出结果的小实验不做。" }),
  Object.freeze({ id: "not-engineering", date: "10-19", quote: "你这感觉变成工程，不是科研了啊", so: "核验做到够做决定就行；子代理只做具体的活；工程不算科研结果。" }),
  Object.freeze({ id: "seeds", date: "10-18", quote: "随机种子从来都是补强论文结论用的，而不是用于改善方法", so: "方法有缺陷就改方法，不靠补种子、加训练步数。" }),
  Object.freeze({ id: "no-self-limits", date: "10-21", quote: "既然有空闲的你怎么不跑，有空显卡就能跑，不要给自己套授权", so: "限制只能来自我的原话；有资源就用。" }),
  Object.freeze({ id: "facts", date: "10-22", quote: "莫须有的东西不准说", so: "数字和结论都要出自读过的文件或跑过的结果。" }),
  Object.freeze({ id: "generality", date: "10-01", quote: "记得科研中通用和泛化很重要，不能局限成某个狭窄场景", so: "用没见过的真实数据和不同类型来判断通用性。" }),
  Object.freeze({ id: "finish", date: "10-12", quote: "那没做完你就赶紧做完呗", so: "已经决定要做的完整实验就做完，不中途收窄。" }),
  Object.freeze({ id: "forward", date: "10-26", quote: "记得是正向寻找，从已有的最新研究出发，而不是先随便虚构一个方案，然后不断收窄方案直到达成我的约束，这是作弊", so: "从最新研究已经做成的出发，组合出一开始就满足要求的方案；继续、推荐和开轮都要有正向证据，“没有反证”不算理由。" }),
  Object.freeze({ id: "triage", date: "10-23", quote: "先整理一下，哪些是我们现在立刻就能做，但之前一直没有做且非常重要的，哪些是非常重要但是一直没有攻克的，有没有办法解决还是得降低要求，还有哪些是可有可无，但是我们一直再做的", so: "停滞或超时的时候，先按这个问题整理一遍，然后来问我。" })
]);

export function userSaying(id) {
  const saying = DOVE_USER_SAYINGS.find((item) => item.id === id);
  if (!saying) throw new Error(`Unknown Dove user saying: ${id}.`);
  return saying;
}

export function renderDoveAuthorPreferencesBootstrap(referencePath = DOVE_AUTHOR_PREFERENCES_REFERENCE_PATH) {
  return `每个新的主上下文（新会话、/clear 之后，或没有启动钩子时第一次用 Skill），主会话在动手前亲自读 \`${referencePath}\`，也就是用户最常说的话。不交给子代理代读；安装过不等于读过。`;
}

export const DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP = renderDoveAuthorPreferencesBootstrap();

export const DOVE_AUTHOR_PREFERENCES_CONTINUITY = "这是同一主上下文的接续：压缩或恢复后沿用已读的“用户最常说的话”；确实丢失才补读。";

export const DOVE_AUTHOR_PREFERENCES_READ_TRIGGER = `${DOVE_AUTHOR_PREFERENCES_MAIN_AGENT_BOOTSTRAP} 按当前请求使用，不把偏好当成研究证据或新增授权。`;

export function renderDoveAuthorPreferencesReference() {
  return `# 用户最常说的话

这些是用户在各个项目里反复说过、对所有项目都适用的话，原文加日期。每个新的主上下文开头亲自读一遍；Dove 会在超时、停滞这样的时刻引用其中的话追问。展开的偏好原文在 [作者偏好全文](AUTHOR_PREFERENCES_FULL.md)，需要时再查。

${DOVE_USER_SAYINGS.map((item, index) => `${index + 1}. “${item.quote}”（${item.date}）\n   所以：${item.so}`).join("\n")}
`;
}

export function renderDoveAuthorPreferencesFullReference() {
  return DOVE_AUTHOR_PREFERENCES_CONTENT;
}
