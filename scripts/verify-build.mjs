// 构建产物校验
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const D = 'dist';
let fail = 0;
const ok = (c, msg) => { console.log(`  ${c ? '\u2713' : '\u2717'} ${msg}`); if (!c) fail++; };

console.log('\n[1] 主页：最新 5 篇文章');
const home = readFileSync(`${D}/index.html`, 'utf8');
const re = /data-index="(\d+)"\s+href="([^"]+)"[\s\S]*?news-item-title">([^<]+)</g;
const items = [...home.matchAll(re)].map((m) => ({ i: m[1], href: m[2], title: m[3] }));
items.forEach((it) => console.log(`      ${it.i}  ${it.title}  ->  ${it.href}`));
ok(items.length === 5, `恰好 5 条（实际 ${items.length}）`);
ok(items.every((_, k) => Number(items[k].i) === k), '序号 0-4 连续');
ok(!home.includes('draft-test'), '草稿未出现在主页');
ok(home.includes('/blog/'), '条目为可点击链接（带 /blog/ 路径）');
ok(home.includes('news-more'), '含「查看全部文章」入口');

console.log('\n[2] 排序：日期倒序');
const dates = [...home.matchAll(/news-item-date">([\d-]+)</g)].map((m) => m[1]);
console.log('     ', dates.join('  '));
ok(
  dates.every((d, k) => k === 0 || dates[k - 1] >= d),
  '从新到旧',
);

console.log('\n[3] 静态资源已随 public/ 复制');
for (const f of [
  'speedup.html', 'index-old.html', 'background3D.html', 'generate-totp.js',
  'images/avatar/abc.jpg', 'vendor/fontawesome/css/all.min.css',
]) ok(existsSync(`${D}/${f}`), f);

console.log('\n[4] 裸 HTML 渲染（Markdown 内插 HTML）');
const art = readFileSync(`${D}/blog/2026-09-20-inline-html-test/index.html`, 'utf8');
ok(art.includes('<details'), '<details> 未被吞掉');
ok(art.includes('<summary'), '<summary> 保留');
ok(/<div style="display:flex/.test(art), '内联 style 的 div 保留');
ok(/<button id="md-demo-btn"/.test(art), '内嵌 <button> 保留');
ok(/md-demo-btn[\s\S]*?addEventListener/.test(art), '内嵌 <script> 保留且带事件监听');
ok(art.includes('<figure data-layout="wide"'), '自定义属性 data-* 保留');
ok(art.includes('<table'), '表格渲染');

console.log('\n[5] 自定义文章模板');
const note = readFileSync(`${D}/blog/2026-10-02-github-actions-cicd/index.html`, 'utf8');
const plain = readFileSync(`${D}/blog/2026-09-17-what-are-you-looking-at/index.html`, 'utf8');
ok(note.includes('class="toc"'), 'tech-note 模板：目录(TOC)已渲染');
ok(!plain.includes('class="toc"'), '默认 PostLayout：无目录');
// 精确取出 TOC 整块再统计（不能用 class="toc" 打头做全局匹配，否则只能匹配到第一条）
const nav = note.match(/<nav class="toc"[\s\S]*?<\/nav>/)?.[0] ?? '';
const tocLinks = [...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
const allIds = [...note.matchAll(/<h([23]) id="([^"]+)"/g)].map((m) => m[2]);
ok(tocLinks.length === allIds.length, `TOC 条目数 == h2/h3 数 (${tocLinks.length})`);
ok(tocLinks.every((t) => allIds.includes(t)), 'TOC 无悬空锚点');

console.log('\n[7] 全站内部链接可解析');
const walk = (d, base = '') =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${d}/${e.name}`, `${base}/${e.name}`) :
    e.name === 'index.html' ? [`${base}/`] : [`${base}/${e.name}`],
  );
const routes = walk(D);
console.log('      ', routes.filter((r) => r.includes('blog')).join('\n       '));
ok(!routes.some((r) => r.includes('draft')), '草稿未生成任何页面');
ok(routes.includes('/blog/'), '列表页存在');
ok(routes.filter((r) => /^\/blog\/[^/]+\/$/.test(r)).length === 5, '文章页 5 个');

// 这些根相对链接指向域名根下其它仓库/服务的路径，本仓库从未包含，属改动前既有问题
const PREEXISTING = [
  '/NBChemistryOffline/', '/NBPhysicsOffline/', '/MirroredWebPage', '/ChunkbaseSeedmapOffline', '/XMYZStudent',
];
console.log('\n[7b] 内部链接');
let broken = [];
let preexisting = [];
for (const r of routes) {
  const p = `${D}/index.html`.replace(/index\.html$/, r === '/' ? 'index.html' : r + 'index.html');
  if (!existsSync(p)) continue;
  const html = readFileSync(p, 'utf8');
  for (const m of html.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const raw = m[1];
    if (raw.startsWith('//')) continue;
    // 中文标签是 URL 编码的，检查文件存在性前必须先解码
    const u = decodeURIComponent(raw);
    const target = u.endsWith('/') ? `${D}${u}index.html` : `${D}${u}`;
    if (existsSync(target)) continue;
    (PREEXISTING.some((x) => u.startsWith(x)) ? preexisting : broken).push(`${r}  ->  ${raw}`);
  }
}
console.log(`      改动前既有死链 ${preexisting.length} 条（指向其它仓库，非本次引入）:`);
[...new Set(preexisting)].forEach((b) => console.log('       -', b));
if (broken.length) { console.log('      新增断链:'); broken.forEach((b) => console.log('       -', b)); }
else console.log('      无新增断链');
ok(broken.length === 0, `无新增断链（新增 ${broken.length}）`);

console.log(`\n${fail === 0 ? '\u5168\u90e8\u901a\u8fc7' : fail + ' \u9879\u5931\u8d25'}\n`);
process.exit(fail ? 1 : 0);