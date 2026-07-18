# 南医八年 · Medical Archive

南方医科大学八年制课程的个人医学学习资料库。网站自动整理仓库根目录中的 Markdown、PDF 与图片，提供全文检索、系统/类型筛选、文章与公式阅读、PDF 预览、多图浏览、收藏、最近浏览和深链接。

## 本地运行

需要 Node.js `>=22.13.0`。在 `site/` 目录执行：

```bash
npm ci
npm run dev
```

常用质量检查与部署命令：

```bash
npm run lint
npm test
npm run build
npm run build:pages
```

- `npm run build`：生成 Cloudflare/vinext 生产产物。
- `npm run build:pages`：生成 `github-pages-dist/` 静态产物。
- `npm test`：执行内容、资源和双部署配置测试；发布前另行执行两条构建命令。

## 内容约定

- 仓库根目录的 `循环系统`、`呼吸系统`、`消化系统`、`临床技能模块二` 是内容源。
- 支持 `.md`、`.pdf`、`.jpg`、`.jpeg`、`.png`；同目录下以 `-1`、`-2` 等结尾的图片自动合并为图集。
- Markdown 引用的本地图片作为文章附件展示，不重复生成资料卡。
- `scripts/generate-content.mjs` 负责生成内容索引和公开资源；请勿手工编辑 `app/notes-data.ts`。
- 生成流程不会修改或删除仓库中的原始医学资料。

## 快捷操作

- `/` 或 `Ctrl/Command + K`：聚焦搜索。
- `Esc`：关闭阅读器；方向键：切换前后资料或图集图片。
- 图片阅读器中使用 `+`、`-`、`0`、`R` 控制缩放、复位和旋转。

资料仅用于个人学习交流，不能替代教材、指南或临床决策。
