// @ts-check
import { defineConfig } from 'astro/config';

// 部署到 GitHub Pages 用户站 mc-lhz.github.io —— 属于 *.github.io 顶级域名，
// 因此不需要设置 base，根相对路径（/speedup.html 等）可原样保留。
export default defineConfig({
  site: 'https://mc-lhz.github.io',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },
});