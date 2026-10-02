---
title: 在 Markdown 里插完整 HTML，实测记录
description: details/summary、内联 style、原生 script、带自定义属性的 div —— 逐个试一遍。
pubDate: 2026-09-20
tags: [markdown, 前端]
---

需求是「写 Markdown，但中间要能插完整 HTML 且正常渲染」。逐个元素试了下面这些。

## 可折叠details

<details>
  <summary><b>点我展开</b></summary>

  里面的内容在浏览器里可正常渲染：

  - 列表能识别
  - <b>加粗</b> 能识别
  - `行内代码` 能识别

</details>

## 内联 style 的 div

<div style="display:flex;gap:12px;align-items:center;background:#f5f8fd;padding:14px 18px;border-radius:10px;margin:1.4em 0">
  <span style="font-size:28px">🚀</span>
  <div style="flex:1">
    <div style="font-weight:700">flex 布局在 Markdown 里也正常</div>
    <div style="font-size:13px;color:#666">说明 HTML 是透传的，不是被转义成字符串</div>
  </div>
</div>

## 带自定义属性的元素

<figure data-layout="wide" style="margin:1.4em 0;padding:12px;border:1px dashed #3c80f0;border-radius:8px;text-align:center;color:#3c80f0;font-size:14px">
  自定义属性和 data-* 都保留了
</figure>

## 原生 script

下面的按钮就是文章正文里的原生 JS 直接控制的：

<button id="md-demo-btn" type="button"
  style="padding:9px 18px;border:1px solid #3c80f0;background:#fff;color:#3c80f0;border-radius:8px;cursor:pointer;font-size:14px;font-family:inherit">
  点我
</button>

<script>
  (function () {
    var btn = document.getElementById('md-demo-btn');
    if (!btn) return;
    var n = 0;
    btn.addEventListener('click', function () {
      n++;
      btn.textContent = n < 2 ? '点我' : '点了 ' + n + ' 次';
    });
  })();
</script>

点了之后文字会变。这说明正文里的 `<script>` 在构建时被保留，并且浏览器端真的执行了。

## 表格

| 写法 | 是否生效 | 说明 |
|---|---|---|
| Markdown 表格 | ✅ | 自动包 `<table>` |
| 裸 `<table>` | ✅ | 原样透传 |
| 内联 `style` | ✅ | 属性保留 |
| `<details>` | ✅ | 常用折叠 |
| `<script>` | ✅ | 浏览器端执行 |

## 结论

`.md` 文件里裸 HTML 直接过，**不需要任何配置**。不用换`.mdx`（那会引入 JSX 语法约束）。

<blockquote>
  对比一下Hugo：它用 Goldmark，默认 <code>unsafe = false</code>，裸 HTML 会被静默吞掉，必须显式开 <code>markup.goldmark.renderer.unsafe = true</code>。踩过这个坑。
</blockquote>