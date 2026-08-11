# 我的静态个人主页（基于 factorization.top）

## 迭代计划

- [x] **第一步：去掉花里胡哨的背景**
  - index / redstone：移除动画彩虹渐变（`linear-gradient(-45deg,#ee7752…)` + `animation: gradient 15s` + `@keyframes gradient`）
  - 删除 `flashScreen()` 背景闪色彩蛋（及其两处调用），保留 alertBomb / shake / changeRandomText 等其它交互
  - 6 页 `<body>` 背景统一改为干净纯色 `#eef2f7`
- [ ] **第二步：更换 JS 框架**（待确认：Vue / React / Svelte / Solid / 保持原生？）

## 运行

```bash
cd my-homepage
python -m http.server 8090
# 浏览器打开 http://localhost:8090/
```

## 说明

- 当前仍是原生 HTML/CSS/JS（继承源站），第三方库本地化在 `vendor/`（function-plot / supabase-js / Font Awesome）。
- 第一步**仅改动 `<body>` 背景与移除背景闪动**，内容、布局、卡片样式、其余交互均不变。
- 仍需联网的部分（与原站一致）：signup/gallery 的 Supabase 后端、tool 天气依赖 wttr.in。
