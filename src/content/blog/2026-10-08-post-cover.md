---
title: 给随笔加一张头图
description: 在 frontmatter 里用 cover 指定头图，首页随笔预览卡和 /blog/ 列表都会用它；没写 cover 就照旧显示占位符，不留空位。
pubDate: 2026-10-08
tags: [前端, astro, 随笔]
cover: https://picsum.photos/seed/mc-lhz-cover/1200/630
---

头图这件事之前一直没做，随笔列表右侧的预览卡永远是那个 📝 占位符 —— 
有点浪费那块290px 的位置。这篇文章就是来补上它的。

## 怎么写

在 frontmatter 里加一行 `cover` 就行，本篇就是这么写的：

```yaml
---
title: 给随笔加一张头图
pubDate: 2026-10-08
cover: https://picsum.photos/seed/mc-lhz-cover/1200/630
---
```

两种路径都支持：

| 写法 | 例子 | 说明 |
|---|---|---|
| 站内路径 | `/images/picsum-100.jpg` | 丢进 `public/images/` 下 |
| 外链 URL | `https://picsum.photos/seed/xxx/1200/630` | **必须 https** |

两个坑值得记一下：

1. **外链必须是 https**。站点本身跑在 https 上，`http://` 的图会被浏览器当混合内容直接拦掉 —— 不是样式问题，是图片根本不加载。
2. **裸相对路径要补斜杠**。写 `images/x.jpg` 而不是 `/images/x.jpg`，在文章页（`/blog/<id>/`）会解析成 `/blog/<id>/images/x.jpg`，必然 404。所以 `src/lib/cover.ts` 里统一做了归一化。

## 没写 cover 会怎样

什么都不显示 —— 不是显示 broken image，也不是留一块空白占位：

- 首页预览卡退回 📝 占位符
- `/blog/` 列表里不出现缩略图位置，卡片布局跟从前一模一样

外链图挂掉也一样：`onerror` 一律退回占位符，不会开天窗。

## 两个界面的实现

**首页随笔区**（`/recent-essays/`，被 iframe 嵌进主页）：封面区高度固定 290px + `object-fit: cover`，所以**换图不会改变卡片高度**，之前那套 iframe 高度自适应上报逻辑完全不受影响。切换条目时从 `data-cover` 读新图并预热，避免闪白。

**`/blog/` 列表**：卡片改成 flex，左侧 96×64 缩略图（移动端 64×44），右侧文字包在 `.post-card-body` 里 —— 不包的话 flex 会把标题、摘要、标签横着排开。

## 一个细节：referrerpolicy

两个 `<img>` 都设了 `referrerpolicy="no-referrer"`。一是外链图床在收到 Referer 时可能直接拒绝热链，二是顺便不把站点地址泄漏出去 —— 这站里那几篇从 QQ 空间搬来的记录就是这么处理的。

顺带说一句：预览卡底色保留了那层淡蓝渐变，所以图没加载出来的时候是一块干净的浅蓝，不是黑洞。