# Pele 图表工作台

一个**纯前端**的 Mermaid 图表工作台：左边写代码，中间实时预览，右边调主题，然后导出 SVG、PNG，或者直接把图片复制到剪贴板。

渲染在浏览器里完成（[pele](https://github.com/obsidianmd/pele)），没有后端、没有数据库、没有服务端字体，构建产物是一堆静态文件，可以直接丢到 GitHub Pages。

> 这里的“图表”指 **Mermaid 图**：流程图、时序图、类图、状态图、ER 图、饼图、XY 图、甘特图、思维导图、时间线等 33 种类型。它不是 ECharts 那种数据驱动图表库。

## 功能

- 左写 Mermaid 代码，中间实时预览，右侧调样式；输入后自动渲染，无网络往返。
- 33 种图**按需加载**：首屏只下载渲染引擎核心，用到哪种图才拉哪种图的代码。
- 支持 Pele 的全部主题变量：背景、文字、节点/分组填充、边框、线条/箭头、强调色、警示色、字体、字重、圆角、8 组系列色。
- 内置浅色、深色两套预设；颜色、圆角、字重等纯 CSS 变量修改**即时生效**，不需要重新渲染。
- 支持字号、线条粗细、虚线、自定义 CSS。
- 导出 SVG（内联主题，下载后可独立打开）。
- 导出 PNG（可调倍率、背景、留白），用 Canvas 在浏览器里栅格化，预览与导出是同一个引擎。
- **一键复制图片**：按当前 PNG 设置生成图片并写入剪贴板，可直接粘到文档、聊天窗口或设计工具。
- 代码、主题和导出设置自动保存在浏览器 localStorage。
- 部署后是一个完全静态的站点：无服务器、无 API 密钥、无运行时费用。

## 在线使用

部署完成后访问：

```text
https://<你的用户名>.github.io/pele/
```

## 本地开发

需要 Node.js 20.19 及以上（Vite 8 的要求）。

```bash
npm install
npm run dev
```

然后打开 `http://localhost:5173`。

其他命令：

```bash
npm run build     # 产出 dist/，纯静态文件
npm run preview   # 本地预览构建产物
npm test          # 渲染与导出逻辑的单元测试
```

## 部署到 GitHub Pages

站点已经按“项目页”配置好了（`vite.config.js` 里的 `base: './'`），资源全部用相对路径，所以 `/pele/`、域名根目录、自定义域名都能直接用，不需要改配置。

### 1. 建仓库并推代码

```bash
git init
git add .
git commit -m "Pele chart studio"
git branch -M main
git remote add origin https://github.com/<你的用户名>/pele.git
git push -u origin main
```

### 2. 打开 Pages

在仓库页面：**Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

### 3. 等第一次部署

推送后 `.github/workflows/deploy.yml` 会自动执行（安装依赖 → 跑测试 → 构建 → 发布）。完成后：

```text
https://<你的用户名>.github.io/pele/
```

也可以在 **Actions** 页面手动触发（workflow 支持 `workflow_dispatch`）。

几点说明：

- 你已有的 `username.github.io` 用户站不受影响：用户站占据域名根目录，这个仓库作为项目页挂在 `/pele/` 下，两者互不干扰。
- 默认分支不是 `main` 也能用：workflow 同时监听 `main` 和 `master`。
- 私有仓库要使用 Pages 需要 GitHub Pro；公开仓库免费。
- 想把工作台放进已有的 `username.github.io` 仓库也可以，但那样得把 `dist/` 的内容复制成该仓库里的一个 `pele/` 子目录，部署脚本要另写；除非有特别理由，建议单独开一个 `pele` 仓库。

## 项目结构

```text
index.html            Vite 入口页面
styles.css            页面样式
favicon.svg
src/
  core/               纯 JS，无 Node、无 DOM 依赖，前后端与测试共用
    theme.js          主题字段、预设、校验、CSS 变量映射
    examples.js       内置 Mermaid 示例
    diagram.js        请求校验、pele 选项、SVG 主题/CSS 注入
    render.js         参考渲染器（完整 pele 构建，供测试对照）
  web/                只在浏览器里运行
    main.js           预览、样式面板、导出、复制等全部交互
    render.js         pele/lazy 渲染入口（按图类型动态加载）
    png.js            SVG → Canvas → PNG
    clipboard.js      复制 PNG 到剪贴板
test/studio.test.js   渲染、主题、CSS 过滤、PNG 尺寸的单元测试
.github/workflows/    自动部署到 GitHub Pages
```

## 工作原理

- **渲染**：`src/web/render.js` 先用 `detectType()` 判断图类型，再 `load(type)` 动态加载对应模块，最后同步渲染。没用到的图类型不会下载。
- **主题**：Pele 用 CSS 自定义属性（`--pele-*`）描述视觉样式。预览时这些变量写在预览容器上，所以改颜色不用重新渲染；导出时把它们内联到 SVG 根节点，让文件可以独立打开。
- **PNG**：把内联了主题的 SVG 包成 Blob，交给 `<img>` 解码，再 `drawImage` 到目标尺寸的 canvas，最后 `toBlob('image/png')`。浏览器按目标分辨率重新栅格化，所以 4x 导出依然清晰。
- **复制**：`navigator.clipboard.write([new ClipboardItem({'image/png': promise})])`。把“未来才生成的 Blob”作为 Promise 传进去，`write()` 就能在点击手势内同步发起（Safari 的要求），栅格化同时进行。
- **配置**：以前来自 `GET /api/schema` 的主题字段和示例，现在直接由 `src/core/theme.js`、`src/core/examples.js` 在构建期带入页面。

## 主题字段

`theme` 可以只传要覆盖的字段，也可以先用 `preset` 指定基础主题。

| key | CSS 变量 | 浅色默认值 | 用途 |
| --- | --- | --- | --- |
| `bg` | `--pele-bg` | `#ffffff` | 画布背景、部分图表文字 |
| `fg` | `--pele-fg` | `#1f1f1f` | 正文文字 |
| `fgOnLight` | `--pele-fg-on-light` | `#1f1f1f` | 浅色填充上的文字 |
| `fgOnDark` | `--pele-fg-on-dark` | `#ffffff` | 深色填充上的文字 |
| `muted` | `--pele-muted` | `#6e6e6e` | 次要文字 |
| `line` | `--pele-line` | `#1f1f1f` | 边线、箭头 |
| `surface` | `--pele-surface` | `#f3f3f3` | 节点填充 |
| `surfaceAlt` | `--pele-surface-alt` | `#e6e6e6` | 子图/分组填充 |
| `border` | `--pele-border` | `#8a8a8a` | 节点和分组边框 |
| `accent` | `--pele-accent` | `#5b7bd5` | 强调色 |
| `critical` | `--pele-critical` | `#e45756` | 甘特图关键任务、看板高优先级等 |
| `font` | `--pele-font` | 系统字体栈 | 正文字体 |
| `fontMono` | `--pele-font-mono` | 等宽字体栈 | 等宽文字 |
| `titleWeight` | `--pele-title-weight` | `700` | 图表标题字重 |
| `headingWeight` | `--pele-heading-weight` | `700` | 图内标题字重 |
| `boldWeight` | `--pele-bold-weight` | `600` | 加粗文字字重 |
| `radius` | `--pele-radius` | `8px` | 圆角，0–64px |
| `series` | `--pele-series-1..8` | 8 个颜色 | 饼图、XY 图、时间线等系列色 |

内置预设：`light`（浅色）、`dark`（深色）。

在 `src/core/theme.js` 里复制 `LIGHT_THEME` 或 `DARK_THEME`，加入 `PRESETS`，就能增加自己的预设。

> 如果 Mermaid 源码自己通过 front matter 的 `themeVariables` 设置了系列色，源码里的颜色优先于主题的 `series`，这是 Pele 的行为。

## 自定义 CSS

自定义 CSS 会放进 SVG 的 `<style>` 中，只影响图表本身。常用类名：

| 类名 | 元素 |
| --- | --- |
| `.pele` | SVG 根元素 |
| `.pele-node` | 节点 |
| `.pele-edge` | 边 |
| `.pele-marker` | 箭头等标记 |
| `.pele-label` | 节点文字 |
| `.pele-cluster` | 子图 |
| `.pele-title` | 图表标题 |
| `.pele-edge-label` | 边上的文字 |

示例：

```css
/* 节点边框加粗 */
.pele-node > rect,
.pele-node > path {
  stroke-width: 2;
}

/* 单独调整箭头颜色 */
.pele-marker {
  fill: var(--pele-accent);
}

/* 按 data-id 改某个节点 */
.pele-node[data-id="start"] .pele-label {
  font-weight: 700;
  fill: var(--pele-accent);
}
```

限制：

- 不允许 `@import`、`url()`、`script/style` 标签等，页面会做过滤。
- 预览里浏览器支持的 CSS 基本都能用（包括伪元素、`@media`），因为预览就是浏览器在渲染。
- 导出和复制走的是“把 SVG 当图片解码再画到 canvas”的路径，图片里不会加载外部资源：`@import`、外部 `url()`、网页字体都不生效，颜色请直接写值或用 `var(--pele-*)`。
- Pele 用 CSS `rx` 实现圆角，浏览器原生支持，预览、PNG、复制三处表现一致。

## PNG 与复制图片

- 导出和复制使用同一套设置：倍率（0.5–4）、背景（跟随主题 / 透明 / 自定义颜色）、留白（0–200px）。
- 浏览器画布上限按 **单边 8192 px、总计 3200 万像素** 收口；超出会提示降低倍率或留白（原来的服务端版本上限是 12000 px / 4000 万像素，浏览器内存扛不住那么大的位图）。
- 字体来自访客系统。默认字体栈是 `system-ui` + 微软雅黑 / 苹方 / Noto Sans SC，所以中文标签开箱可用；如果想让导出用某个特定字体，需要访客本机安装它（网页字体不会被带进图片）。
- 复制图片依赖 Clipboard API 的 `image/png` 支持：Chrome / Edge 76+、Safari 13.1+、Firefox 127+。不支持的浏览器上“复制图片”会置灰或提示改用“导出 PNG”。剪贴板需要 HTTPS 或 localhost。

## 与旧版（Node 服务端）的差异

| 旧版 | 现在 |
| --- | --- |
| Express 服务 + `POST /api/render*` | 全部在浏览器里完成，没有 HTTP 接口 |
| `@resvg/resvg-js` 原生模块渲染 PNG | Canvas 栅格化，零原生依赖 |
| `./fonts` 目录 / `FONT_DIRS` 加载服务端字体 | 删除，使用访客系统字体 |
| `POST /api/schema` 提供主题字段 | 构建期直接来自 `src/core/theme.js` |
| PNG 上限 12000 px / 40 MP | 8192 px / 32 MP |
| 只监听 `127.0.0.1`，公网需要反向代理 | 静态托管，没有会被攻击的进程 |
| localStorage key `pele-workbench:v1` | `pele-workbench:v2`（旧数据不迁移） |

## 兼容性

- 现代 Chromium / Firefox / Safari 均可。`pele/lazy` 依赖动态 `import()`，很老的浏览器不行。
- 不使用任何服务端能力，所以离线（首次加载后）也能用；如需完全离线可以再加 Service Worker。
- SVG 导出是标准 SVG 1.1 + CSS 变量内联，Illustrator、Figma、Inkscape、浏览器都能打开。

## 许可

MIT。构建产物包含 Pele（MIT）与 Lucide 图标（ISC），完整声明见 [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md)。
