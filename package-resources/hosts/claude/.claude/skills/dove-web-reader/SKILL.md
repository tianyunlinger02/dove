---
name: dove-web-reader
description: 当前工作需要网页正文时，用 Exa、WebFetch 或直接下载读取实际内容。
user-invocable: false
---

# Dove 网页阅读

内容会影响判断时，读实际页面。

- `WebSearch` 用于发现；正文可用 `exa` 或 `WebFetch`。工具缺失、额度用完或失败时，换可用方式；无法渲染的页面或 PDF 用 `curl`／`wget` 下载后读。
- 论文优先用 `dove-paper-search`，不可用时同样换来源。
- 说清实际读到的是全文、PDF 还是搜索摘要，不把摘要判断说成全文依据。
