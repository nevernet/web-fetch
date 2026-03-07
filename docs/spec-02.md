# Web-Fetch CLI + Web 监控面板 规范设计

## 概述

统一的命令行工具 + Web 监控面板，整合新闻采集、监控、配置管理等功能。

## 技术栈

### 依赖
```json
{
  "dependencies": {
    "dotenv": "^17.3.1",
    "commander": "^12.0.0",
    "chalk": "^4.1.2",
    "ora": "^5.4.1",
    "axios": "^1.6.0",
    "turndown": "^7.1.2",
    "express": "^4.18.0",
    "ws": "^8.14.0"
  }
}
```

| 工具 | 用途 |
|------|------|
| commander | CLI 参数解析 |
| chalk | 命令行着色 |
| ora | loading 动画 |
| axios | HTTP 请求 |
| turndown | HTML → Markdown |
| express | Web 服务 |
| ws | WebSocket (实时日志) |

---

## 使用方式

```bash
# CLI 模式
node src/index.js <command> [options]

# Web 模式 (后台服务)
node src/index.js server
# 访问 http://localhost:8081
```

---

## 命令列表 (CLI)

### 1. 采集新闻
```bash
node src/index.js fetch           # JSON 输出
node src/index.js fetch --format text  # 文本摘要
node src/index.js fetch -f list       # 简单列表
```

### 2. 监控统计 (CLI)
```bash
node src/index.js stats           # 统计面板
node src/index.js stats --verbose # 详细统计
```

### 3. 告警配置
```bash
node src/index.js alert               # 查看配置
node src/index.js alert enable        # 启用告警
node src/index.js alert disable       # 禁用告警
node src/index.js alert telegram --chat-id <id>
node src/index.js alert rule --errors 5 --rate 80
```

### 4. 日志查看
```bash
node src/index.js log           # 查看日志
node src/index.js log --follow  # 实时日志
node src/index.js log --level error
```

### 5. 服务管理
```bash
node src/index.js server start    # 启动 Web 服务
node src/index.js server stop     # 停止
node src/index.js server restart  # 重启
node src/index.js server status   # 状态
```

### 6. 清理
```bash
node src/index.js clean cache   # 清除缓存
node src/index.js clean logs    # 清除日志
node src/index.js clean stats   # 清除统计
node src/index.js clean all     # 清除所有
```

### 7. 帮助
```bash
node src/index.js help
node src/index.js -h
```

---

## Web 监控面板

### 访问地址
```
http://localhost:8081
```

### 功能

| 页面 | 路径 | 功能 |
|------|------|------|
| 首页 | `/` | 概览仪表盘 |
| 统计 | `/stats` | 历史统计图表 |
| 日志 | `/logs` | 实时日志流 |
| 采集 | `/fetch` | 手动触发采集 |
| 配置 | `/config` | 告警/参数配置 |

### 首页仪表盘

```
┌─────────────────────────────────────────────────┐
│  Web-Fetch 监控面板                              │
├─────────────────────────────────────────────────┤
│  运行状态: 🟢 运行中      最后采集: 10分钟前      │
├─────────────────────────────────────────────────┤
│  📊 统计概览                                     │
│  ┌─────────┬─────────┬─────────┬─────────┐      │
│  │ 总运行   │ 总文章  │ 成功率  │ 平均耗时 │      │
│  │ 15次    │ 156篇   │ 93.3%   │ 52s     │      │
│  └─────────┴─────────┴─────────┴─────────┘      │
├─────────────────────────────────────────────────┤
│  📈 来源分布 (饼图/条形图)                        │
│  - 新浪: 45%                                    │
│  - 虎嗅: 30%                                    │
│  - 36氪: 25%                                    │
├─────────────────────────────────────────────────┤
│  📰 最新采集                                     │
│  • 新浪: 以军超80架战机空袭伊朗...               │
│  • 虎嗅: AI界卷起"养龙虾"风暴...                │
├─────────────────────────────────────────────────┤
│  [采集新闻] [查看日志] [系统配置]                  │
└─────────────────────────────────────────────────┘
```

### 实时日志页

- WebSocket 推送实时日志
- 支持按级别筛选 (ERROR/WARN/INFO/DEBUG)
- 支持搜索

### 技术实现

```javascript
// Web 服务 (express + ws)
const express = require('express');
const { WebSocketServer } = require('ws');

const app = express();
const server = app.listen(8081);
const wss = new WebSocketServer({ server });

// WebSocket 推送实时日志
wss.on('connection', (ws) => {
  logger.on('log', (entry) => {
    ws.send(JSON.stringify(entry));
  });
});
```

---

## 目录结构

```
src/
├── index.js              # 主入口 (路由分发)
├── commands/             # CLI 命令
│   ├── fetch.js         # 采集命令
│   ├── stats.js         # 统计命令
│   ├── alert.js         # 告警命令
│   ├── log.js           # 日志命令
│   ├── server.js        # 服务管理
│   └── clean.js         # 清理命令
├── lib/                 # 核心库
│   ├── fetcher.js       # 采集核心
│   ├── logger.js        # 日志系统
│   ├── monitor.js       # 监控统计
│   ├── alert.js         # 告警管理
│   └── config.js        # 配置管理
├── web/                 # Web 面板
│   ├── app.js          # Express 应用
│   ├── routes/         # 页面路由
│   ├── public/        # 静态资源
│   └── views/          # HTML 模板
└── logs/               # 日志目录
    ├── fetcher.log
    ├── stats.json
    └── alert.json
```

---

## 全局选项

| 选项 | 说明 |
|------|------|
| `-h, --help` | 显示帮助 |
| `-v, --version` | 显示版本 |
| `--config <path>` | 指定配置文件 |

---

## 配置 (config.json)

```json
{
  "version": "1.0",
  "server": {
    "port": 8081,
    "webPort": 8081
  },
  "fetch": {
    "timeout": 30000,
    "retries": 3,
    "sources": [...]
  },
  "alert": {
    "enabled": false,
    "telegram": {...},
    "feishu": {...},
    "rules": {...}
  },
  "pm2": {
    "name": "web-fetch"
  }
}
```

---

## 示例

```bash
# 安装依赖
npm install

# 采集新闻
node src/index.js fetch

# 启动 Web 面板
node src/index.js server start
# 访问 http://localhost:8081

# 查看统计
node src/index.js stats
```

---

## 定时任务与 OpenClaw 配合

### 方式 1: OpenClaw Cron 调用 CLI

在 OpenClaw 中配置定时任务，直接调用 CLI：

```bash
# OpenClaw cron 配置
node /root/workspaces/github/nevernet/web-fetch/src/index.js fetch
```

**现有 OpenClaw 定时配置示例：**
```json
{
  "name": "国内新闻-9点",
  "schedule": "0 9 * * *",
  "payload": {
    "message": "cd /root/workspaces/github/nevernet/web-fetch && node src/index.js fetch"
  },
  "delivery": {
    "mode": "announce",
    "channel": "telegram",
    "to": "5293440463"
  }
}
```

### 方式 2: Web API 触发

Web 面板提供采集触发接口：

```bash
# 触发采集 (POST)
curl -X POST http://localhost:8081/api/fetch

# 触发采集 + 推送 (POST)
curl -X POST http://localhost:8081/api/fetch \
  -H "Content-Type: application/json" \
  -d '{"push": true, "channels": ["telegram"]}'
```

### 定时任务配置

```json
{
  "schedules": [
    { "name": "早间新闻", "cron": "0 9 * * *", "command": "fetch", "push": true },
    { "name": "午间AI", "cron": "0 12 * * *", "command": "fetch", "push": true },
    { "name": "晚间国际", "cron": "0 21 * * *", "command": "fetch", "push": true }
  ]
}
```

### 配合流程

```
OpenClaw Cron
     │
     ▼
┌──────────────┐
│ CLI / API    │
│ fetch        │
└──────────────┘
     │
     ▼
┌──────────────┐
│ 采集核心     │
│ fetcher.js   │
└──────────────┘
     │
     ├──────────────────┐
     ▼                  ▼
┌─────────┐      ┌─────────┐
│ Web面板  │      │ 告警    │
│ 统计更新 │      │ 推送    │
└─────────┘      └─────────┘
```

---

## 数据导出

```bash
# 导出为 JSON
node src/index.js export --format json

# 导出为 CSV
node src/index.js export --format csv

# 导出指定日期
node src/index.js export --from 2026-03-01 --to 2026-03-07
```

Web 面板支持一键导出。
