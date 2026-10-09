// 头图路径归一化。
//
// frontmatter 里的 cover 允许三种写法，渲染前统一成浏览器能直接用的 src：
//   /images/x.jpg                 站内绝对路径，原样用
//   https://…/x.jpg  //cdn…/x.jpg 外链，原样用（必须 https）
//   images/x.jpg                  裸相对路径 —— 补前导斜杠
//
// 最后一条是必要的：文章页在 /blog/<id>/ 下，裸相对路径会解析成
// /blog/<id>/images/x.jpg 必然 404。
export const coverSrc = (cover?: string): string | undefined => {
  const c = (cover ?? '').trim();
  if (!c) return undefined;
  if (/^https?:\/\//i.test(c) || c.startsWith('//') || c.startsWith('/') || c.startsWith('data:')) {
    return c;
  }
  return '/' + c;
};