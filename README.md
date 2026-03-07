# Web-Fetch

AI 驱动的网页数据采集服务 + CLI 工具 + Web 监控面板

## 功能

### 核心服务 (API)
- 🌐 网页抓取 (Scrape) - URL → Markdown/HTML/JSON
- 🔍 搜索 (Search) - DuckDuckGo 搜索集成
- 📄 结构化提取 (Extract) - 自动提取标题/链接
- 🐦 Reddit 新闻源 - 热门帖子/搜索
- ⚙️ 自适应抓取 - 智能重试/降级
- 📦 缓存机制 - 本地文件缓存

### CLI 工具
```bash
# 采集新闻
node src/index.js fetch

# 查看统计
node src/index.js stats

# 告警配置
node src/index.js alert

# 查看日志
node src/index.js log

# 清理数据
node src/index.js clean all
```

### Web 监控面板
```bash
# 启动 Web 面板
node src/index.js server start

# 访问
http://localhost:8081
```

## 快速开始

### 安装
```bash
npm install
```

### 启动 API 服务
```bash
pm2 start ecosystem.config.js
```

### 使用 CLI
```bash
# 采集新闻
node src/index.js fetch

# 采集并输出文本
node src/index.js fetch --format text
```

### 使用 Web 面板
```bash
node src/index.js server start
# 访问 http://localhost:8081
```

## 项目结构

```
web-fetch/
├── src/
│   ├── index.js         # CLI 入口
│   ├── commands/        # CLI 命令
│   │   ├── fetch.js   # 采集
│   │   ├── stats.js   # 统计
│   │   ├── alert.js  # 告警
│   │   ├── log.js    # 日志
│   │   ├── server.js # 服务
│   │   └── clean.js  # 清理
│   ├── lib/           # 核心库
│   │   └── fetcher.js
│   └── web/           # Web 面板
│       └── app.js
├── logs/              # 日志/统计
├── docs/              # 文档
└── package.json
```

## API

| 接口 | 方法 | 说明 |
|------|------|------|
| /scrape | POST | 网页抓取 |
| /search | POST | 搜索 |
| /extract | POST | 结构化提取 |
| /reddit/hot | GET | Reddit 热门 |
| /cache/status | GET | 缓存状态 |

## 配置

环境变量:
- `PORT` - API 服务端口 (默认 8080)
- `WEB_PORT` - Web 面板端口 (默认 8081)
- `HTTP_PROXY` - 代理地址

## 文档

- [功能规划](docs/spec-01.md)
- [CLI + Web 规范](docs/spec-02.md)
- [开发计划](docs/plan-02.md)

## License

MIT
