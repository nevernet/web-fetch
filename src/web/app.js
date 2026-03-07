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
  
  const sourceData = Object.keys(stats.bySource || {}).map(s => ({
    name: s,
    articles: (stats.bySource[s]?.articles || 0),
    errors: (stats.bySource[s]?.errors || 0)
  }));
  
  res.send(`
<!DOCTYPE html>
<html lang="zh-CN" class="light dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Web-Fetch 监控面板</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config({
      darkMode: 'class',
      theme: {
        extend: {}
      }
    }
  </script>
</head>
<body class="bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 min-h-screen transition-colors">
  <div class="max-w-6xl mx-auto px-4 py-6">
    <!-- Header -->
    <header class="mb-6">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-gray-800 dark:text-white">🕷️ Web-Fetch</h1>
        <button id="theme-toggle" class="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition">
          🌙
        </button>
      </div>
    </header>
    
    <!-- Navigation -->
    <nav class="flex gap-2 mb-6">
      <a href="/" class="px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition">仪表盘</a>
      <a href="/stats" class="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition">统计</a>
      <a href="/logs" class="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition">日志</a>
      <a href="/fetch" class="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition">采集</a>
      <a href="/config" class="px-4 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition">配置</a>
    </nav>
    
    <!-- Stats Cards -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">${stats.totalRuns}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">总运行次数</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-3xl font-bold text-green-600 dark:text-green-400">${stats.totalArticles}</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">总采集文章</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-3xl font-bold text-purple-600 dark:text-purple-400">${successRate}%</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">成功率</div>
      </div>
      <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">${avgTime}s</div>
        <div class="text-sm text-gray-500 dark:text-gray-400">平均耗时</div>
      </div>
    </div>
    
    <!-- Source Distribution -->
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
      <h2 class="text-xl font-semibold mb-4">📈 来源分布</h2>
      <div class="space-y-3">
        ${sourceData.length > 0 ? sourceData.map(s => `
        <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <span class="font-medium">${s.name}</span>
          <span class="text-sm ${s.errors > 0 ? 'text-red-500' : 'text-green-500'}">
            ${s.articles} 篇 ${s.errors > 0 ? `(${s.errors} 错误)` : ''}
          </span>
        </div>
        `).join('') : '<p class="text-gray-500">暂无数据</p>'}
      </div>
    </div>
    
    <!-- Quick Actions -->
    <div class="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h2 class="text-xl font-semibold mb-4">⚡ 快速操作</h2>
      <div class="flex gap-3">
        <button onclick="fetchNews()" class="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition">
          采集新闻
        </button>
        <button onclick="location.reload()" class="px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition">
          刷新
        </button>
      </div>
      <div id="fetch-result" class="mt-4 p-4 bg-gray-100 dark:bg-gray-700 rounded-lg hidden"></div>
    </div>
  </div>
  
  <script>
    // Theme Toggle
    const toggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    
    // Check system preference
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    
    toggle.addEventListener('click', () => {
      html.classList.toggle('dark');
      localStorage.theme = html.classList.contains('dark') ? 'dark' : 'light';
      toggle.textContent = html.classList.contains('dark') ? '☀️' : '🌙';
    });
    
    // Initial icon
    toggle.textContent = html.classList.contains('dark') ? '☀️' : '🌙';
    
    // Fetch News
    async function fetchNews() {
      const result = document.getElementById('fetch-result');
      result.classList.remove('hidden');
      result.innerHTML = '<span class="text-blue-500">采集中...</span>';
      
      try {
        const res = await fetch('/api/fetch', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          result.innerHTML = '<span class="text-green-500">✓ 采集完成! ' + data.count + ' 篇</span>';
        } else {
          result.innerHTML = '<span class="text-red-500">✗ ' + (data.error || '采集失败') + '</span>';
        }
      } catch (e) {
        result.innerHTML = '<span class="text-red-500">✗ 网络错误</span>';
      }
    }
  </script>
</body>
</html>
  `);
});

// 统计页面
app.get('/stats', (req, res) => {
  const stats = loadStats();
  res.json(stats);
});

// 日志页面
app.get('/logs', (req, res) => {
  const logs = loadLogs();
  res.json(logs);
});

// 配置页面
app.get('/config', (req, res) => {
  const config = loadConfig();
  res.json(config);
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
    console.log('🌐 Web 面板运行在 http://localhost:' + port);
  });
  
  const wss = new WebSocketServer({ server });
  wss.on('connection', (ws) => {
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
