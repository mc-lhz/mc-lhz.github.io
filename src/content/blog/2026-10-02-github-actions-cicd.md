---
title: 用 GitHub Actions 给博客做真正的 CI/CD
description: 一次 git push，自动构建并部署到 GitHub Pages。Astro + 内容集合的完整流水线。
pubDate: 2026-10-02
tags: [devops, ci, astro]
template: tech-note
---

以前改主页要手动改 HTML、手动上传。现在这套流程只有一个动作：`git push`。

## 整体流程

```
src/content/blog/*.md
        │  git push
        ▼
  GitHub Actions
        │  npm ci && npm run build
        ▼
      dist/          ← 纯静态 HTML
        │
        ▼
mc-lhz.github.io
```

关键点：**访客打开页面时没有任何请求**。文章标题、日期这些在构建阶段就已经写死在 HTML 里了，不是运行时 fetch 的。

## 为什么不用前端 fetch

常见做法是主页写一段 JS 去请求一个 JSON 接口。问题是：

- 多一次网络往返，首屏要等
- 接口挂了就是白屏
- 有跨域和SEO 问题

构建时生成则没有这些问题 —— 生成的HTML 里内容本来就在。

<div style="background:#f5f8fd;border-left:4px solid #3c80f0;padding:14px 18px;border-radius:0 8px 8px 0;margin:1.4em 0">
  <b>构建时 vs 运行时</b>
  <ul style="margin:.6em 0 0;padding-left:1.2em">
    <li>构建时：零 JS、零接口、可缓存、SEO 友好 —— 静态站点的正确选择</li>
    <li>运行时：内容实时，但代价是多一次请求和一堆失败场景</li>
  </ul>
</div>

## 核心就四行

```astro
---
import { getCollection } from 'astro:content';

const latest = (await getCollection('blog'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
  .slice(0, 5);
---
```

后面就是一个循环：

```astro
{latest.map((post, i) => (
  <a href={`/blog/${post.id}/`}>
    <h3>{post.data.title}</h3>
    <span>{post.data.pubDate.toISOString().slice(0, 10)}</span>
  </a>
))}
```

<details>
  <summary><b>为什么排序是 <code>b - a</code>？</b></summary>

  `Array.sort()` 默认按升序（a - b）。我们想要**新的在前**，所以把两个参数反过来写成 `b - a`。这个错误很常见——写反了就会变成「最旧的文章排在最前面」。
</details>

## workflow 配置

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ master ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: withastro/action@v5
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/deploy-pages@v4
        id: deployment
```

## 踩过的坑

### 1. Pages 的 Source 必须选 GitHub Actions

在仓库 `Settings → Pages` 里，Source 要选 **GitHub Actions**，不是 `Deploy from a branch`。选错了 workflow 会跑但没效果。

### 2. 用户站不需要 base

`mc-lhz.github.io` 属于 `*.github.io` 顶级路径，仓库名就是站点根。所以 `astro.config.mjs` 里**不用配 `base`**。如果是 `mc-lhz.github.io/my-blog` 这种项目站，就必须配 `base: '/my-blog'`，且所有内部链接都要带这个前缀。

### 3. frontmatter 写错会在构建时炸

内容集合用 zod 定义 schema，字段名或类型不对会**直接让构建失败**，而不是静默发到线上。这是比运行时校验可靠得多的一层。

| 情况 | 运行时校验 | Astro 构建时校验 |
|---|---|---|
| 少写 `pubDate` | 页面上显示 undefined | ✅ 构建失败，看得到报错 |
| `tags` 写成字符串 | 可能正常渲染 | ✅ 构建失败 |

## 以后写文章的流程

```bash
# 1. 新建文件
vim src/content/blog/hello.md

# 2. 本地预览（保存即热更新）
npm run dev

# 3. 提交上线
git add . && git commit -m "add: hello" && git push
```

没有后台、没有数据库、没有管理界面。一个 `.md` 文件就是一篇完整的文章。