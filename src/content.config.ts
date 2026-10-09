import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 博客文章集合：glob 扫描 src/content/blog/ 下的所有 .md
// schema 用 zod 做 frontmatter 校验 —— 字段写错或类型不对会在构建时报错，
// 而不是像现在这样静默发到线上。
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/[^_]*.md' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // 可选：指定使用哪个文章模板（相对 src/layouts/ 的文件名）
    template: z.string().optional(),
    // 可选：主页右侧预览卡显示的文字，默认取 title
    previewText: z.string().optional(),
    // 可选：头图。站内路径（/images/x.jpg）或外链 URL（须 https，http 会被按混合内容拦掉）。
    // 不写就不显示 —— 预览卡退回占位符，列表页不出现缩略图空位。
    cover: z.string().optional(),
  }),
});

export const collections = { blog };