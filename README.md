# MUTTER TOOLS

一个直接部署到 GitHub Pages 的纯静态工具站点，不需要安装依赖或执行构建。

## 目录结构

```text
.
├── index.html       # 站点入口和工具导航
├── src/             # 可直接访问的工具页与阅读页
│   └── invest/      # 投资阅读内容
├── cdn/             # 随站点托管的第三方静态依赖
├── .nojekyll        # 跳过 Jekyll，按原样发布静态文件
└── LICENSE
```

`index.html`、`src/` 和 `cdn/` 都是发布内容。请保留它们的相对路径，避免已发布页面或浏览器书签失效。

## 本地预览

在仓库根目录启动任意静态文件服务器，例如：

```sh
python3 -m http.server 8000
```

然后访问 <http://localhost:8000>。不要直接双击 HTML 文件预览；部分浏览器能力在 `file://` 协议下会受到限制。

## 发布

GitHub Pages 的发布源应设置为 `main` 分支的仓库根目录（`/`）。推送后无需额外构建步骤。
