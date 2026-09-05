# Dove 开发文档

本目录保存 Dove 稳定产品语义。它不是实时任务记录，也不替代 `.dove/research/` 中的项目研究上下文或 `.trellis/spec/` 中的实现规范。

## 文档索引

- [愿景与设计理念](VISION_AND_PRINCIPLES.md)：Dove 为什么存在，以及长期应坚持的少量原则。
- [研究模型](RESEARCH_MODEL.md)：完整科研语义，包括持续研究、Mission、研究树、九个平级能力、作者主会话、有界 subagent 和同一研究者的隔离审稿位置。
- [产品需求](PRODUCT_REQUIREMENTS.md)：实现和公共文件必须满足的产品要求。
- [最终期望](FINAL_EXPECTATIONS.md)：用户在真实使用中应观察到的结果。
- [行为评估](../../evals/behavior/README.md)：合成案例、真实宿主调用、公开证据和人工判断；不随 npm 包发布。

## 使用方式

1. Vision 只保留长期原则，不堆积临时规则。
2. Research Model 是完整科研语义的唯一展开处。
3. Product Requirements 把语义转为实现要求。
4. Final Expectations 描述可观察结果，而不是测试清单或实现细节。

公共文档、实现和生成文件应与这里保持一致；真实研究进展来自项目证据、实验、稿件、图、代码、Review 和用户决策，而不是这些开发文档本身。
