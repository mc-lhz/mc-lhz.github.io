---
title: 把主页接上 Astro 内容集合
description: 原本写死在 HTML 里的一条随笔，现在由构建时自动生成，并且能点进去了。
pubDate: 2026-09-28
tags: [astro, 前端]
---

原来主页的「近期随笔」是这样的：

```html
<div class="news-item active" data-index="0">
  <span class="news-item-index">01</span>
  <div class="news-item-content">
    <h3 class="news-item-title">看我干嘛？</h3>
    <span class="news-item-date">2026-09-17</span>
  </div>
  <span class="news-item-arrow">›</span>
</div>
```

三条问题：

1. 写死的，发新文章要手动改HTML
2. `<div>` 加 click 监听，**根本跳不过去** —— 点了只换右边预览文字
3. 没法有第二篇

## 改完之后

```astro
---
const latest = (await getCollection('blog'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
  .slice(0, 5);
---

{latest.map((post, i) => (
  <a
    class:list={['news-item', { active: i === 0 }]}
    data-index={i}
    href={`/blog/${post.id}/`}
  >
    <span class="news-item-index">{String(i + 1).padStart(2, '0')}</span>
    <div class="news-item-content">
      <h3 class="news-item-title">{post.data.title}</h3>
      <span class="news-item-date">{fmtDate(post.data.pubDate)}</span>
    </div>
    <span class="news-item-arrow">›</span>
  </a>
))}
```

## 两个容易踩的坑

### class名不能改

主页那段现成的 JS 是靠 class 名抓文本来换预览卡的：

```js
var title = item.querySelector('.news-item-title');
var date  = item.querySelector('.news-item-date');
var cover = preview.querySelector('.cover-placeholder span');
```

`index.html` 里原来的 `.news-item-title` / `.news-item-date` 一个都不能少，否则右边预览会变空白。

<div style="background:#fff8e6;border-left:4px solid #f0b429;padding:14px 18px;border-radius:0 8px 8px 0;margin:1.4em 0">
  <b>教训</b>
  <p style="margin:.5em 0 0">复用旧样式时，先确认 JS 有没有依赖某个 class 名做选择器。CSS 看着能显示，不代表交互还活着。</p>
</div>

### 日期别直接用 toISOString

```js
// 有坑
post.data.pubDate.toISOString().slice(0, 10)

// 改成按本地时区格式化
const fmtDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
```

`toISOString()` 输出的是 UTC。东八区晚上 8 点之后写的文章，取到的日期会**比实际早一天**。

## 顺手修的

- `<div>` 换成 `<a>`，条目终于能点进去了。原来 `text-decoration: none; color: inherit` 样式早就写好了，说明当初就是按链接设计的，只是没用上。
- 预览卡也改成 `<a>`，点整张卡都能进。
- 导航加了「全部随笔」入口。
- 列表末尾加了「查看全部文章 →」。