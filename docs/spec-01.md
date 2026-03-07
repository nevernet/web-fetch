# Web-Fetch 核心功能规划

## 项目概述

Web-Fetch 是一个面向 AI 的网页数据采集服务，将任意网站转换为 LLM 可用的结构化数据。

## 核心功能

| 功能 | 状态 | 描述 |
|------|------|------|
| 网页抓取 (Scrape) | ✅ | URL → Markdown/HTML/JSON |
| 网站爬取 (Crawl) | ✅ | 递归抓取整个网站 |
| 结构化提取 (Extract) | ✅ | 自动提取标题、链接 |
| 搜索 (Search) | ✅ | DuckDuckGo 搜索 |
| 代理支持 | ✅ | HTTP_PROXY |
| 缓存机制 | ✅ | 本地文件缓存 |
| Playwright | ✅ | JS 动态页面渲染 |
| Reddit | ✅ | API 集成 |
| 自适应抓取 | ✅ | 站点状态追踪 |

## API

### POST /scrape
```bash
curl -X POST http://localhost:8080/scrape \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","formats":["markdown"]}'
```

### POST /search
```bash
curl -X POST http://localhost:8080/search \
  -H "Content-Type: application/json" \
  -d '{"query":"AI news","limit":5}'
```

### POST /extract
```bash
curl -X POST http://localhost:8080/extract \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

### GET /reddit/hot
```bash
curl http://localhost:8080/reddit/hot?subreddit=technology&limit=5
```

### GET /cache/status
```bash
curl http://localhost:8080/cache/status
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| PORT | 8080 | 服务端口 |
| HTTP_PROXY | http://127.0.0.1:7890 | HTTP 代理 |
| CACHE_ENABLED | true | 启用缓存 |
| CACHE_TTL | 3600 | 缓存秒数 |
| FETCH_URL | http://localhost:8080 | 采集服务地址 |

## 新闻采集

### fetcher.js
```bash
node src/fetcher.js           # JSON 输出
node src/fetcher.js text      # 文本摘要
node src/fetcher.js list      # 简单列表
```

### voice.js
```bash
node src/fetcher.js | node src/voice.js  # 生成语音稿
```

## 测试清单

| 功能 | 测试用例 | 命令 |
|------|----------|------|
| ✅ 健康检查 | GET /health | curl http://localhost:8080/health |
| ✅ 网页抓取 | 抓取、链接、HTML | POST /scrape |
| ✅ 搜索 | 基本、带内容 | POST /search |
| ✅ 提取 | 标题/描述 | POST /extract |
| ✅ 缓存 | 状态、清除 | GET/POST /cache/* |
| ✅ Reddit | 热门、搜索 | GET /reddit/* |
| ✅ 代理 | BBC 访问 | POST /scrape (bbc.com) |
| ✅ 采集 | JSON/文本/列表 | node src/fetcher.js |
| ✅ 语音 | 管道组合 | node src/fetcher.js \| node src/voice.js |

```bash
# 运行测试
node tests/index.js
```

## OpenClaw 集成

### 创建 Skill

**目录结构：**
```
~/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/webfetch/
└── SKILL.md
```

**SKILL.md：**
```yaml
---
name: webfetch
description: "网页数据采集服务。用于：抓取网页内容、搜索信息、提取结构化数据。"
metadata: { "openclaw": { "emoji": "🕷️" } }
---

# Web Fetch Skill

调用 web-fetch 服务进行网页数据采集。

## 功能

- 网页抓取 (Scrape)
- 搜索 (Search)
- 结构化提取 (Extract)
- Reddit 热门

## 命令

### 网页抓取
curl -X POST http://localhost:8080/scrape -H "Content-Type: application/json" -d '{"url":"https://example.com","formats":["markdown"]}'

### 搜索
curl -X POST http://localhost:8080/search -H "Content-Type: application/json" -d '{"query":"AI news","limit":5}'
```

### 安装
```bash
mkdir -p ~/.nvm/versions/node/v22.22.0/lib/node_modules/openclaw/skills/webfetch/
# 复制 SKILL.md 到该目录
```

### 使用
用户可以说：
- "帮我抓取 xxx 网站"
- "搜索 xxx 新闻"
- "提取 xxx 页面的标题"

## 待开发

- [ ] 分布式部署

---

*最后更新: 2026-03-07*
