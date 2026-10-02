# mc_lhz 个人主页 + 随笔（Astro）

静态站点，零运行时 JS。推送 `master` 后由 GitHub Actions 自动构建并部署到
`mc-lhz.github.io`。

## 写文章

**新建一个 `.md` 文件就是发一篇文章。** 没有后台、没有数据库、没有管理界面。

```
src/content/blog/
├── 2026-10-02-github-actions-cicd.md
├── 2026-09-28-astro-integration.md
└── 2026-09-05-draft-test.md        # draft: true，不会发布
```

frontmatter 可用字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | **必填** |
| `description` | string | 摘要，用于列表页和 `<meta name="description">` |
| `pubDate` | date | **必填**，主页按此倒序取最新 5 篇 |
| `updatedDate` | date | 可选 |
| `tags` | string[] | 可选，自动生成 `/blog/tag/<tag>/` 页 |
| `draft` | boolean | `true` 则主页/列表/详情页都不生成 |
| `template` | string | 可选，`tech-note` 切换到带目录的模板 |
| `previewText` | string | 可选，主页右侧预览卡的文字，默认取 `title` |

字段写错或类型不对**会在构建时直接失败**，不会静默发布。

### Markdown 里插完整 HTML

`.md` 里裸 HTML 直接透传，**无需任何配置**，不用换 `.mdx`：

```markdown
<details>
  <summary><b>点我展开</b></summary>
  <div style="background:#f5f8fd;padding:14px">内联样式保留</div>
</details>

<button id="x">原生 JS 也能跑</button>
<script>document.getElementById('x').onclick = () => alert(1)</script>
```

正文排版样式定义在 `src/layouts/PostLayout.astro` 的 `<style is:global>` 中。

> 必须 `is:global`：markdown 渲染出的 `h2`/`p`/`code` 不带组件 scope id，
> 默认 scoped 会让所有后代选择器失效。

## 文章模板

`src/layouts/` 下每个 `.astro` 文件就是一个模板，文章 frontmatter 用 `template` 选：

| 文件 | 用途 |
|---|---|
| `BaseLayout.astro` | 最基础外壳（`<html>`/`<head>`/字体/设计变量） |
| `PostLayout.astro` | 默认文章模板：标题 + 日期 + 标签 + 正文 |
| `tech-note.astro` | 技术笔记：继承 PostLayout，额外渲染目录（TOC） |
| `HomeLayout.astro` | 主页专用（由旧 `index.html` 的 42KB CSS 生成，勿手改） |

新增模板 = 加一个 `.astro` 文件，然后在 `src/pages/blog/[id].astro` 的三元里加一个分支。

模板之间可继承：

```astro
---
import PostLayout from './PostLayout.astro';
---
<PostLayout {...Astro.props}><slot /></PostLayout>
```

## 主页的「近期随笔」

`src/pages/index.astro` 在**构建时**读取文章并写死进 HTML：

```astro
const latest = (await getCollection('blog'))
  .filter((p) => !p.data.draft)
  .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
  .slice(0, 5);
```

访客打开主页不会发起任何请求。排序 `b - a` 表示「新的在前」，写反会变成最旧在前。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:4321 ，保存即热更新
npm run build      # 产出 dist/
npm run verify     # 构建 + 校验产物（链接、裸 HTML、模板、草稿过滤）
npm run preview    # 本地预览 dist/
```

国内网络装依赖慢的话：

```bash
npm config set registry https://registry.npmmirror.com
```

## 目录结构

```
├── astro.config.mjs        # site= mc-lhz.github.io（用户站，无需 base）
├── src/
│   ├── content.config.ts   # blog 集合的 zod schema
│   ├── content/blog/*.md   # 文章
│   ├── layouts/            # 文章模板
│   ├── components/         # PostCard 等
│   ├── styles/global.css   # 全局设计变量（必须全局，见文件内注释）
│   └── pages/
│       ├── index.astro     # 主页
│       └── blog/           # [id].astro / index.astro / tag/[tag].astro
├── public/                 # 原样复制到 dist 根，根相对链接因此保持可用
│   ├── index-old.html      # 怀旧版主页
│   ├── speedup.html        # GitHub 加速页
│   ├── background3D.html   # Three.js 背景（被 iframe 引入）
│   ├── generate-totp.js
│   ├── images/  vendor/
├── Factorization/          # factorization.top 镜像，当前无入口链接（孤儿目录）
└── .github/workflows/deploy.yml
```

`public/` 用 `git mv` 迁移而非复制，文件历史得以保留。

## 部署

`.github/workflows/deploy.yml` 在 push 到 `master` 时触发：
`checkout` → `setup-node` → `npm ci` → `npm run build` → 强制推送到
`mc-lhz/mc-lhz.github.io` 的 `master`。

需要仓库配置一个 `DEPLOY_TOKEN` secret（对该仓库有 contents 写权限的 PAT）。
仓库 Settings → Pages 保持 `Deploy from a branch` 即可，本方案不依赖 Actions 部署。

## 已知问题

- 主页 6 条项目链接（`/MirroredWebPage`、`/NBChemistryOffline` 等）指向域名根下其它仓库的
  路径，本仓库从未包含对应文件，属改动前既有的死链。
- `background3D.html:42` 仍从 unpkg 加载 three.js。`public/vendor/three/` 已下载但零引用
  且未纳入版本控制（原先是根目录的未跟踪文件，随 `vendor/` 一起移入 `public/`）。
- `Factorization/` 目录下无任何入口链接。

## 设计说明

- **主页的 TOTP 面板是有意公开的**（`src/pages/index.astro` 内的 `TOTP_SECRET`，
  以及 30s / 3600s 两组动态验证码）。这是刻意的功能设计，不是泄露事故，不要按
  「密钥外泄」处理，也不要自动轮换。算法在 `public/generate-totp.js`
  （零依赖 SHA-1 + HMAC，含 RFC 6238 附录 B 自测向量）。