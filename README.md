# Web-Fetch

AI 驱动的网页数据采集服务，将任意网站转换为 LLM 可用的结构化数据。

## 功能特性

| 功能 | 描述 | API |
|------|------|-----|
| 🌐 网页抓取 | 单 URL 转 Markdown/HTML/JSON | POST /scrape |
| 🕷️ 网站爬取 | 递归抓取整个网站 | POST /crawl |
| 🔍 搜索 | Bing/Google 搜索 + 内容提取 | POST /search |
| 📊 结构化提取 | 自动提取标题/链接/图片 | POST /extract |
| 🔄 代理支持 | 自动访问国外网站 | 内置 |
| 🎭 Playwright | JS 动态页面渲染 | 可选 |

## 快速开始

### 安装

```bash
cd web-fetch
npm install
```

### 运行

```bash
# 默认代理 http://127.0.0.1:7890
node src/index.js

# 自定义代理
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
{
  "url": "https://www.bbc.com/news",
  "options": {
    "formats": ["markdown", "html", "links"],
    "timeout": 30000,
    "playwright": false
  }
}
```

### 网站爬取 (Crawl)

```bash
POST /crawl
{
  "url": "https://example.com",
  "options": {
    "maxDepth": 2,
    "limit": 20
  }
}
```

### 搜索 (Search) - RAG 专用

```bash
POST /search
{
  "query": "AI news 2026",
  "options": {
    "limit": 10,
    "includeContent": true
  }
}
```

**响应示例 (RAG 格式):**
```json
{
  "success": true,
  "data": {
    "query": "AI news 2026",
    "results": [
      {
        "url": "https://techcrunch.com/ai...",
        "title": "OpenAI Announces GPT-5",
        "snippet": "OpenAI has announced the next generation...",
        "content": "完整内容摘要...",
        "publishedAt": "2026-03-01"
      }
    ]
  }
}
```

### 结构化提取 (Extract)

```bash
POST /extract
{
  "url": "https://www.bbc.com/news"
}
```

## 实现原理

### 1. 混合抓取策略

```
┌─────────────────────────────────────────────────┐
│              Web-Fetch Server                   │
├─────────────────────────────────────────────────┤
│  1. Playwright (JS 渲染)                      │
│     - 支持 SPA/React/Vue 等动态页面            │
│     - 等待元素加载、滚动触发懒加载             │
│     - 截图、DOM 操作                           │
├─────────────────────────────────────────────────┤
│  2. Curl (HTTP 请求)                          │
│     - 轻量快速，适合静态页面                   │
│     - 自动代理转发                             │
│     - 无外部依赖                               │
└─────────────────────────────────────────────────┘
```

### 2. 搜索流程 (RAG 专用)

```
用户查询 → Bing API → 搜索结果页 → 提取链接 → 逐个抓取内容 → RAG 格式输出

优化点：
- 并发抓取多个结果
- 自动生成内容摘要 (snippet)
- 提取关键信息 (title, publishedAt)
- 支持 RAG 直接接入
```

### 3. HTML 转 Markdown

- 去除 script/style/nav/footer
- 保留标题、段落、列表、链接
- 转换图片为 Markdown 格式
- 清理 HTML 标签

### 4. 代理机制

- 默认使用 HTTP_PROXY 环境变量
- 支持企业代理/科学上网
- 自动处理 HTTPS

## 配置

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| PORT | 8080 | 服务端口 |
| HTTP_PROXY | http://127.0.0.1:7890 | HTTP 代理 |
| HTTPS_PROXY | http://127.0.0.1:7890 | HTTPS 代理 |

## RAG 接入示例

```javascript
// 1. 搜索相关网页
const searchResult = await fetch('http://localhost:8080/search', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: '什么是大语言模型',
    options: { includeContent: true }
  })
});

// 2. 获取结果 (已格式化，适合直接喂给 LLM)
const results = searchResult.data.results;

// 3. 构建 prompt
const context = results.map(r => r.content).join('\n\n');
const prompt = `根据以下资料回答问题：\n\n${context}\n\n问题：${question}`;
```

## 技术栈

- Node.js
- Playwright (可选)
- 原生 HTTP / Curl

## 许可证

MIT
