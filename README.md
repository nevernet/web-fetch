# Web-Fetch

AI 驱动的网页数据采集服务，将任意网站转换为 LLM 可用的结构化数据。

## 功能特性

- 🌐 **网页抓取** - 支持任意 URL 转 Markdown/HTML/JSON
- 🕷️ **网站爬取** - 递归抓取整个网站，支持深度控制
- 🔍 **搜索功能** - Bing 搜索 + 结果提取
- 📊 **结构化提取** - 自动提取标题、描述、链接等
- 🔄 **代理支持** - 自动通过代理访问国外网站
- 📝 **格式转换** - HTML 转 Markdown，去除噪音内容

## 快速开始

### 安装

```bash
cd web-fetch
npm install
```

### 运行

```bash
# 默认使用代理 http://127.0.0.1:7890
node src/index.js

# 或自定义代理
HTTP_PROXY=http://your-proxy:port node src/index.js
```

服务启动于 `http://localhost:8080`

## API

### 健康检查

```bash
GET /health
```

### 网页抓取 (Scrape)

```bash
POST /scrape
Content-Type: application/json

{
  "url": "https://www.bbc.com/news",
  "options": {
    "formats": ["markdown", "html", "links"],
    "timeout": 30000
  }
}
```

### 网站爬取 (Crawl)

```bash
POST /crawl
Content-Type: application/json

{
  "url": "https://example.com",
  "options": {
    "maxDepth": 2,
    "limit": 20,
    "timeout": 30000
  }
}
```

### 搜索 (Search)

```bash
POST /search
Content-Type: application/json

{
  "query": "AI news 2026",
  "options": {
    "limit": 10
  }
}
```

### 结构化提取 (Extract)

```bash
POST /extract
Content-Type: application/json

{
  "url": "https://www.bbc.com/news"
}
```

### 响应示例

```json
{
  "success": true,
  "data": {
    "metadata": {
      "sourceURL": "https://www.bbc.com/news",
      "title": "BBC News",
      "description": "Breaking news..."
    },
    "markdown": "# BBC News\n\nBreaking news...",
    "links": ["https://...", "https://..."]
  }
}
```

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| PORT | 8080 | 服务端口 |
| HTTP_PROXY | http://127.0.0.1:7890 | HTTP 代理地址 |

## 技术栈

- Node.js
- 原生 HTTP (无外部依赖)
- curl (底层网络请求)

## 许可证

MIT
