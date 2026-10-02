---
title: 这是一篇草稿，不该出现在主页
description: 用来验证 draft 过滤是否生效
pubDate: 2026-09-05
draft: true
---

frontmatter 里写了 `draft: true`。

主页的 `getCollection` 链里有 `.filter((p) => !p.data.draft)`，所以：

- **主页列表** —— 不会出现
- **/blog/ 列表页** —— 不会出现（`getCollection` 第二参数过滤）
- **/blog/this-id/** —— 也生成不出来（`[id].astro` 的 getStaticPaths 同样过滤）

三处都过滤了。这篇文件留着是为了验证这件事。