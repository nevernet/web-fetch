/**
 * Web 监控面板 - Express 应用
 */

const express = require('express');
const path = require('path');
const { WebSocketServer } = require('ws');
const fs = require('fs');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
const STATS_FILE = path.join(LOGS_DIR, 'stats.json');
const ALERT_FILE = path.join(LOGS_DIR, 'alert.json');

const WEB_PORT = process.env.WEB_PORT || 8081;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============ 工具函数 ============

function loadStats() {
  try {
    if (fs.existsSync(STATS_FILE)) {
      return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { totalRuns: 0, totalArticles: 0, totalErrors: 0, totalTimeMs: 0, bySource: {} };
}

function loadConfig() {
  try {
    if (fs.existsSync(ALERT_FILE)) {
      return JSON.parse(fs.readFileSync(ALERT_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { enabled: false, rules: {} };
}

function loadLogs() {
  try {
    const logFile = path.join(LOGS_DIR, 'fetcher.log');
    if (fs.existsSync(logFile)) {
      const content = fs.readFileSync(logFile, 'utf-8');
      return content.split('\n').filter(l => l).slice(-100);
    }
  } catch (e) {}
  return [];
}

// ============ 路由 ============

// 首页 / 仪表盘
app.get('/', (req, res) => {
  const stats = loadStats();
  const avgTime = stats.totalRuns > 0 ? (stats.totalTimeMs / stats.totalRuns / 1000).toFixed(1) : 0;
  const avgArticles = stats.totalRuns > 0 ? (stats.totalArticles / stats.totalRuns).toFixed(1) : 0;
  const successRate = stats.totalRuns > 0 ? ((1 - stats.totalErrors / stats.totalRuns) * 100).toFixed(1) : 100;
  
  // 来源分布
  const sourceLabels = Object.keys(stats.bySource || {});
  const sourceData = sourceLabels.map(s => ({
    name: s,
    articles: (stats.bySource[s]?.articles || 0),
    errors: (stats.bySource[s]?.errors || 0)
  }));
  
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Web-Fetch 监控面板</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f7fa; }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; margin-bottom: 20px; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .stat-item { text-align: center; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .stat-value { font-size: 28px; font-weight: bold; color: #2196f3; }
    .stat-label { color: #666; font-size: 14px; margin-top: 5px; }
    .nav { display: flex; gap: 10px; margin-bottom: 20px; }
    .nav a { padding: 10px 20px; background: white; color: #333; text-decoration: none; border-radius: 6px; }
    .nav a:hover { background: #e3f2fd; }
    .source-list { display: flex; flex-direction: column; gap: 10px; }
    .source-item { display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 6px; }
    .status { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #4caf50; }
    pre { background: #263238; color: #aed581; padding: 15px; border-radius: 6px; overflow-x: auto; max-height: 400px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🕷️ Web-Fetch 监控面板</h1>
    
    <div class="nav">
      <a href="/">仪表盘</a>
      <a href="/stats">统计</a>
      <a href="/logs">日志</a>
      <a href="/fetch">采集</a>
      <a href="/config">配置</a>
    </div>
    
    <div class="card">
      <h2>📊 运行状态</h2>
      <div class="stats">
        <div class="stat-item">
          <div class="stat-value">${stats.totalRuns}</div>
          <div class="stat-label">总运行次数</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${stats.totalArticles}</div>
          <div class="stat-label">总采集文章</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${successRate}%</div>
          <div class="stat-label">成功率</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${avgTime}s</div>
          <div class="stat-label">平均耗时</div>
        </div>
      </div>
    </div>
    
    <div class="card">
      <h2>📈 来源分布</h2>
      <div class="source-list">
        ${sourceData.map(s => `
        <div class="source-item">
          <span>${s.name}</span>
          <span>${s.articles} 篇 ${s.errors > 0 ? '(' + s.errors + '错误)' : ''}</span>
        </div>
        `).join('')}
        ${sourceData.length === 0 ? '<p>暂无数据</p>' : ''}
      </div>
    </div>
    
    <div class="card">
      <h2>📰 最新采集</h2>
      <pre>运行 CLI: node src/index.js fetch</pre>
    </div>
  </div>
</body>
</html>
  `);
});

// 统计页面
app.get('/stats', (req, res) => {
  const stats = loadStats();
  res.send(JSON.stringify(stats, null, 2));
});

// 日志页面
app.get('/logs', (req, res) => {
  const logs = loadLogs();
  res.send(JSON.stringify(logs, null, 2));
});

// 配置页面
app.get('/config', (req, res) => {
  const config = loadConfig();
  res.send(JSON.stringify(config, null, 2));
});

// 手动采集触发
app.post('/api/fetch', async (req, res) => {
  try {
    const fetcher = require('../lib/fetcher');
    const results = await fetcher.fetchAll();
    res.json({ success: true, count: results.length });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// 启动服务
function start(port = WEB_PORT) {
  const server = app.listen(port, () => {
    console.log(`🌐 Web 面板运行在 http://localhost:${port}`);
  });
  
  // WebSocket
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
    console.log('WebSocket 客户端连接');
    
    // 定期推送日志
    const interval = setInterval(() => {
      const logs = loadLogs();
      if (logs.length > 0) {
        ws.send(JSON.stringify({ type: 'log', data: logs.slice(-10) }));
      }
    }, 3000);
    
    ws.on('close', () => clearInterval(interval));
  });
  
  return server;
}

module.exports = { app, start };
