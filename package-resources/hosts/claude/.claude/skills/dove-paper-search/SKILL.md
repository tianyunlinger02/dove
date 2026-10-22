---
name: dove-paper-search
description: 当前工作需要论文时，用 dove-paper-search 检索、核对、下载并读正文。
user-invocable: false
---

# Dove 论文检索

用 `dove-paper-search` MCP 找论文、核对信息和读正文。

- 按问题选来源，不遍历所有索引。
- 需要 DOI 时先用 `get_crossref_paper_by_doi`，再模糊搜标题；核对标题、作者、年份和版本。
- 元数据不等于论文。判断某篇支持主张前读实际正文，说清读了全文、摘要还是元数据。
- 优先用来源自身的开放下载；需要 `download_with_fallback` 时传 `use_scihub: false`。
- 工具不可用就用 arXiv／Crossref API、出版方、OpenReview 或 `curl` 下载 PDF 后读，不把检索故障当作没有论文。
