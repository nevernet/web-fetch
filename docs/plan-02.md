# Plan-02: CLI + Web 监控面板重构

## 目标

将现有 fetcher.js 重构为统一的 CLI 工具 + Web 监控面板

---

## ✅ Phase 1: 基础设施 (已完成)

| 任务 | 状态 |
|------|------|
| 1.1 添加依赖 | ✅ commander, chalk, ora, axios, turndown, express, ws |
| 1.2 创建目录结构 | ✅ src/commands/, src/lib/, src/web/ |
| 1.3 重构 fetcher.js | ✅ lib/fetcher.js 模块化 |

---

## ✅ Phase 2: CLI 命令 (已完成)

| 命令 | 文件 | 状态 |
|------|------|------|
| fetch | commands/fetch.js | ✅ |
| stats | commands/stats.js | ✅ |
| alert | commands/alert.js | ✅ |
| log | commands/log.js | ✅ |
| server | commands/server.js | ✅ |
| clean | commands/clean.js | ✅ |

---

## ✅ Phase 3: Web 监控面板 (已完成)

### 3.1 Express 服务
- ✅ web/app.js

### 3.2 页面
| 页面 | 功能 | 状态 |
|------|------|------|
| `/` | 首页仪表盘 | ✅ |
| `/stats` | 统计 API | ✅ |
| `/logs` | 日志 API | ✅ |
| `/fetch` | 手动采集 | ✅ |
| `/config` | 配置 API | ✅ |

### 3.3 WebSocket
- ✅ 实时日志推送 (预留)

---

## 待测试

- [ ] CLI 全命令测试
- [ ] Web 面板功能测试
- [ ] 与 OpenClaw 定时集成

---

## 里程碑

| 版本 | 内容 | 状态 |
|------|------|------|
| v2.0 | CLI 重构完成 | ✅ |
| v2.1 | Web 面板上线 | ✅ |
| v2.2 | 整合测试 | ⏳ |

---

## 使用方式

```bash
# CLI
node src/index.js fetch
node src/index.js stats
node src/index.js alert

# Web
node src/index.js server start
# 访问 http://localhost:8081
```
