// 构建产物校验
import { readFileSync, existsSync, readdirSync } from 'node:fs';

const D = 'dist';
let fail = 0;
const ok = (c, msg) => { console.log(`  ${c ? '\u2713' : '\u2717'} ${msg}`); if (!c) fail++; };

console.log('\n[0] 样式作用域健全性');
// Astro 默认给 <style> 内的选择器加 [data-astro-cid-*]，但该属性只会打给
// 组件自身模板里的元素。若样式写在只含 <slot/> 的布局里，HTML 上一个 cid 都没有，
// 整份样式表静默失效（主页会退化成未样式化的原始 HTML）。
// 判据：CSS 里出现 cid 作用域，而产物 HTML 里没有 —— 必然是这种错误。
{
  const cssFiles = readdirSync(`${D}/_astro`).filter((f) => f.endsWith('.css'));
  let scopedHits = 0;
  for (const f of cssFiles) {
    const c = readFileSync(`${D}/_astro/${f}`, 'utf8');
    scopedHits += (c.match(/data-astro-cid-/g) || []).length;
  }
  const htmlCid =
    (readFileSync(`${D}/index.html`, 'utf8').match(/data-astro-cid-/g) || []).length;
  ok(scopedHits === 0 || htmlCid > 0,
    `CSS cid ${scopedHits} 处 / HTML cid ${htmlCid} 处（两者不应单边为 0）`);

  // 抽查主页关键选择器未被 scope 化
  const mainCss = cssFiles
    .map((f) => readFileSync(`${D}/_astro/${f}`, 'utf8'))
    .find((c) => c.includes('.glass-card')) ?? '';
  for (const sel of ['.glass-card', '.indicator', '.news-item', '.top-bar', ':root']) {
    const scoped = new RegExp(sel.replace('.', '\\.') + '\\[data-astro-cid-').test(mainCss);
    ok(!scoped, `${sel} 未被 scope 化`);
  }
}

console.log('\n[0] 字体完整性');
// 截断的 woff2 会返回 200 且 wOF2 魔数正确，但浏览器 OTS 解析失败（OTS parsing error），
// 只有比对「头部声明长度 vs 实际字节数」才能发现。CI 每次构建都应拦一次。
{
  const dir = `${D}/vendor/fontawesome/webfonts`;
  if (existsSync(dir)) {
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.woff2')).sort()) {
      const b = readFileSync(`${dir}/${f}`);
      const sig = b.toString('ascii', 0, 4);
      const declared = b.readUInt32BE(8);
      const good = sig === 'wOF2' && declared === b.length;
      ok(good, `${f}  ${b.length} 字节 / 头声明 ${declared}${good ? '' : '  <-- 截断或损坏'}`);
    }
    // ttf 只校验 sfnt 版本号
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.ttf')).sort()) {
      const sfnt = readFileSync(`${dir}/${f}`).readUInt32BE(0);
      ok([0x00010000, 0x4f54544f, 0x74727565].includes(sfnt),
        `${f}  sfnt=0x${sfnt.toString(16)}`);
    }
  } else {
    ok(false, '字体目录缺失: vendor/fontawesome/webfonts');
  }
}

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
// 找一篇正文里带了裸 HTML 的文章，而不是写死文件名。
{
  const blogDir = 'src/content/blog';
  const probe = readdirSync(blogDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .find((f) => {
      const p = `${D}/blog/${f.replace(/\.md$/, '')}/index.html`;
      if (!existsSync(p)) return false;
      return /<button id="md-demo-btn"|<details/.test(readFileSync(p, 'utf8'));
    });
  ok(!!probe, '存在含裸 HTML 的文章用于验证');
  if (probe) {
    const art = readFileSync(`${D}/blog/${probe.replace(/\.md$/, '')}/index.html`, 'utf8');
    ok(art.includes('<details'), '<details> 未被吞掉');
    ok(art.includes('<summary'), '<summary> 保留');
    ok(/<div style="display:flex/.test(art), '内联 style 的 div 保留');
    ok(/<table/.test(art), '表格渲染');
    // 这两个只在那篇「实测记录」里存在，用宽松断言避免绑死具体文章
    ok(/<button id="md-demo-btn"/.test(art) || !/<button/.test(art),
      '内嵌 <button> 保留（该文章未含 button 则跳过）');
    ok(/md-demo-btn[\s\S]*?addEventListener/.test(art)
      || !/md-demo-btn/.test(art),
      '内嵌 <script> + 事件监听保留（该文章未含则跳过）');
    ok(/<figure data-layout="wide"/.test(art) || !/<figure/.test(art),
      '自定义属性 data-* 保留（该文章未含 figure 则跳过）');
  }
}

console.log('\n[5] 自定义文章模板');
// 不要硬编码具体文件名 —— 文章随时可能被删或改名。
// 改为从 frontmatter 里找：template: tech-note 的那篇 vs没指定的那篇。
{
  const blogDir = 'src/content/blog';
  const files = readdirSync(blogDir).filter((f) => f.endsWith('.md') && !f.startsWith('_'));
  const isDraft = (f) => /^draft:\s*true/m.test(readFileSync(`${blogDir}/${f}`, 'utf8'));
  const usesTechNote = (f) => /^template:\s*tech-note/m.test(readFileSync(`${blogDir}/${f}`, 'utf8'));
  const live = files.filter((f) => !isDraft(f));
  const id = (f) => f.replace(/\.md$/, '');
  const techFile = live.find(usesTechNote);
  const plainFile = live.find((f) => !usesTechNote(f));

  ok(!!techFile, '存在使用 tech-note 模板的文章');
  ok(!!plainFile, '存在使用默认模板的文章');

  if (techFile) {
    const note = readFileSync(`${D}/blog/${id(techFile)}/index.html`, 'utf8');
    ok(note.includes('class="toc"'), `tech-note 模板：目录(TOC)已渲染 (${id(techFile)})`);
    // 精确取出 TOC 整块再统计（不能用 class="toc" 打头做全局匹配，否则只能匹配到第一条）
    const nav = note.match(/<nav class="toc"[\s\S]*?<\/nav>/)?.[0] ?? '';
    const tocLinks = [...nav.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
    const allIds = [...note.matchAll(/<h([23]) id="([^"]+)"/g)].map((m) => m[2]);
    ok(tocLinks.length === allIds.length, `TOC 条目数 == h2/h3 数 (${tocLinks.length})`);
    ok(tocLinks.every((t) => allIds.includes(t)), 'TOC 无悬空锚点');
  }
  if (plainFile) {
    const plain = readFileSync(`${D}/blog/${id(plainFile)}/index.html`, 'utf8');
    ok(!plain.includes('class="toc"'), `默认 PostLayout：无目录 (${id(plainFile)})`);
  }
}

console.log('\n[7] 全站内部链接可解析');
const walk = (d, base = '') =>
  readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(`${d}/${e.name}`, `${base}/${e.name}`) :
    e.name === 'index.html' ? [`${base}/`] : [`${base}/${e.name}`],
  );
const routes = walk(D);
console.log('      ', routes.filter((r) => r.includes('blog')).join('\n       '));

// 文章数量会变，不能写死5。按实际非草稿 .md 数量比对。
{
  const blogDir = 'src/content/blog';
  const mdFiles = readdirSync(blogDir)
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .map((f) => f.replace(/\.md$/, ''));
  const drafts = mdFiles.filter(
    (id) => /^draft:\s*true/m.test(readFileSync(`${blogDir}/${id}.md`, 'utf8')),
  );
  const expected = mdFiles.filter((id) => !drafts.includes(id));
  const actual = routes.filter((r) => /^\/blog\/[^/]+\/$/.test(r));

  ok(actual.length === expected.length,
    `文章页数量 == 非草稿文章数 (${actual.length} vs ${expected.length})`);
  for (const d of drafts) {
    ok(!routes.includes(`/blog/${d}/`), `草稿 ${d} 未生成页面`);
  }
  // 草稿文件名里含 "draft" 只是约定，不作为判断依据；上面的逐个比对才是
  ok(drafts.length ? `草稿 ${drafts.length} 篇均已排除` : '无草稿', drafts.length ? '' : '');
}
ok(routes.includes('/blog/'), '列表页存在');

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