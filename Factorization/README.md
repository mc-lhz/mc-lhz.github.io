# factorization.top 本地镜像

纯静态个人主页镜像。**前端完全自包含，无需 `server.py` / COOP-COEP 头**（本站无 WASM-GC / WebGPU）。

## 运行

```bash
cd factorization.top
python -m http.server 8090
# 浏览器打开 http://localhost:8090/
```

## 目录结构

```
factorization.top/
├── index.html        # 个人主页
├── redstone.html     # 红石社官网
├── tool.html         # 10合1工具箱（番茄钟/密码生成/天气/换算/倒计时）
├── graph.html        # 函数图像生成器（function-plot）
├── signup.html       # 起床战争报名（Supabase 写入）
├── gallery.html      # 图片墙（Supabase 读取）
├── images/           # avatar/abc.jpg + picsum 占位图（已本地化）
└── vendor/           # 本地化的第三方库
    ├── function-plot.js          # 函数图像（已内联 d3）
    ├── supabase.js               # Supabase JS v2（UMD，window.supabase）
    └── fontawesome/              # Font Awesome 6.4.0 css + webfonts
```

## 与原站差异（已处理）

- 三个 CDN 库（Font Awesome / function-plot / @supabase/supabase-js）已下载到 `vendor/` 并改写引用，**不再依赖 jsDelivr / cdnjs**。
- Cloudflare 邮箱混淆（`/cdn-cgi/l/email-protection#...`）已解码为真实 `mailto:` 链接（`fx@factorization.top`、`factorizationx@gmail.com`）。
- 已删除失效的 Cloudflare 追踪脚本（email-decode / Pages Analytics / challenge-platform）。

## 仍需联网的部分（与原站一致，无法本地化）

- `signup.html` / `gallery.html` 的数据读写依赖 **Supabase**（`pdbfinlvocsggkuslkqv.supabase.co`）——后端即服务，必须联网。
- `tool.html` 的天气功能依赖 **wttr.in** 运行时 API——需联网。
- 社交链接（bilibili / x / youtube 等）为外链，正常。
