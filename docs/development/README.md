# Dove 开发文档

本目录保存 Dove 稳定产品语义。它不是实时任务记录，也不替代 `.dove/research/` 中的项目研究上下文或 `.trellis/spec/` 中的实现规范。

## 文档索引

- [愿景与研究者立场](VISION_AND_PRINCIPLES.md)：Dove 为什么存在，以及长期应坚持的整体判断与行动原则。
- [研究模型](RESEARCH_MODEL.md)：主线选择、导师与轮次、固定记录、证据判断、九项能力和独立审稿的完整语义。
- [3.4.0 结构调整](RESTRUCTURE_3_4_0.md)：导师职责、轮次与短记录重构。
- [3.4.1 参考吸收](ABSORB_REFERENCES_3_4_1.md)：缺口、跨领域机制、对抗评审与项目文献库；记录替换、长度、检查和正常使用观察。
- [3.4.10 意图与追踪](INTENT_AND_TRACKING_3_4_10.md)：周期意图对照、原话预热、面板展示和导师建议的实际保存。
- [3.4.11 研究者立场](RESEARCHER_STANCE_3_4_11.md)：总纲的默认接入、冲突规则替换与实际交付证据。
- [产品需求](PRODUCT_REQUIREMENTS.md)：实现和公共文件必须满足的产品要求。
- [最终期望](FINAL_EXPECTATIONS.md)：用户在真实使用中应观察到的结果。
- [行为评估](../../evals/behavior/README.md)：合成案例、真实宿主调用、公开证据和人工判断；不随 npm 包发布。

## 使用方式

1. Vision 是人读的研究者立场总纲；运行时权威来源为 `src/core/dove-research-contract.mjs`，不把本文档变成第二份提示词或新增必读阶段。
2. Research Model 展开具体科研语义，沿现有 renderer 和质量材料送达普通 Claude、DSH 与导师。
3. Product Requirements 把语义转为实现要求。
4. Final Expectations 描述待观察结果，而不是测试清单或已验收结论；带版本号的文件保留当时发行事实。

公共文档、实现和生成文件应与这里保持一致；真实研究进展来自项目证据、实验、稿件、图、代码、Review 和用户决策，而不是这些开发文档本身。
