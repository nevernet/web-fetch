/**
 * News Fetcher - 采集核心模块
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 获取项目根目录
const PROJECT_ROOT = process.cwd();
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

// 确保目录存在
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// ============ 配置 ============

const FETCH_URL = process.env.FETCH_URL || 'http://localhost:8080';
const FETCH_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const STATS_FILE = path.join(LOGS_DIR, 'stats.json');
const ALERT_FILE = path.join(LOGS_DIR, 'alert.json');

const NEWS_SOURCES = [
  { name: '新浪新闻', url: 'https://news.sina.com.cn/', cat: '综合',
    subUrls: ['https://news.sina.com.cn/china/', 'https://news.sina.com.cn/world/'] },
  { name: '凤凰网', url: 'https://www.ifeng.com/', cat: '综合',
    subUrls: ['https://news.ifeng.com/'] },
  { name: '虎嗅', url: 'https://www.huxiu.com/', cat: '科技',
    subUrls: ['https://www.huxiu.com/article/'] },
  { name: '36氪', url: 'https://www.36kr.com/', cat: '科技',
    subUrls: ['https://www.36kr.com/news/'] },
  { name: '腾讯新闻', url: 'https://news.qq.com/', cat: '综合',
    subUrls: ['https://news.qq.com/gn.htm', 'https://news.qq.com/gj.htm'] }
];

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// ============ 错误类 ============

class FetchError extends Error {
  constructor(message, type) { super(message); this.name = 'FetchError'; this.type = type; }
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ============ HTTP 请求 ============

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, FETCH_URL);
    const options = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method: method,
      headers: { 'Content-Type': 'application/json', 'User-Agent': DEFAULT_UA }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { reject(new FetchError('JSON解析失败', 'parse')); }
      });
    });
    req.on('error', (e) => reject(new FetchError('网络错误: ' + e.message, 'network')));
    req.setTimeout(FETCH_TIMEOUT, () => { req.destroy(); reject(new FetchError('请求超时', 'timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function fetchWithRetry(url, formats, attempt = 1) {
  try {
    const res = await request('POST', '/scrape', { url, formats, options: { timeout: FETCH_TIMEOUT, noCache: true } });
    if (!res.data) throw new FetchError('空响应', 'logic');
    if (!res.data.success) throw new FetchError(res.data.error || '抓取失败', 'logic');
    if (!res.data.data?.markdown) throw new FetchError('无内容', 'logic');
    return res.data;
  } catch (e) {
    if (attempt < MAX_RETRIES && (e.type === 'network' || e.type === 'timeout')) {
      await delay(RETRY_DELAY * attempt);
      return fetchWithRetry(url, formats, attempt + 1);
    }
    throw e;
  }
}

async function fetchPage(url, formats = ['markdown']) {
  try { return await fetchWithRetry(url, formats); }
  catch (e) { return null; }
}

// ============ 链接提取 ============

function extractNewsLinks(text, domain) {
  const links = [];
  const patterns = [
    /\[([^\]]{6,})\]\((https?:\/\/[a-z0-9\-\.]+\/[a-z0-9_\-\/\.]+\.(s?html?|php|htm))\)/gi,
    /\[([^\]]{6,})\]\((https?:\/\/[a-z0-9\-\.]+\/doc-[a-z0-9_\-]+\.s?html?)\)/gi,
    /\[([^\]]{6,})\]\((https?:\/\/[a-z0-9\-\.]+\/article\/[a-z0-9_\-]+\.s?html?)\)/gi,
  ];
  for (const pattern of patterns) {
    let m;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(text)) !== null) {
      const title = m[1].replace(/[!*\[\]]/g, '').trim();
      const link = m[2];
      if (title.length > 6 && (link.includes(domain) || domain.includes('qq.com')) &&
          !link.includes('javascript') && !link.includes('void') && !link.includes('login')) {
        if (!links.find(l => l.link === link)) links.push({ title, link });
      }
      if (links.length >= 5) break;
    }
    if (links.length > 0) break;
  }
  return links;
}

// ============ 统计管理 ============

function loadStats() {
  try { if (fs.existsSync(STATS_FILE)) return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8')); } catch (e) {}
  return { totalRuns: 0, totalArticles: 0, totalErrors: 0, totalTimeMs: 0, lastRun: null, bySource: {} };
}

function saveStats(stats) {
  try { fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2)); } catch (e) {}
}

function recordStats(sessionStats) {
  const stats = loadStats();
  stats.totalRuns++;
  stats.totalArticles += sessionStats.articles;
  stats.totalErrors += sessionStats.errors;
  stats.totalTimeMs += sessionStats.duration;
  stats.lastRun = new Date().toISOString();
  if (sessionStats.bySource) {
    for (const [source, data] of Object.entries(sessionStats.bySource)) {
      if (!stats.bySource[source]) stats.bySource[source] = { runs: 0, articles: 0, errors: 0 };
      stats.bySource[source].runs++;
      stats.bySource[source].articles += data.articles || 0;
      stats.bySource[source].errors += data.errors || 0;
    }
  }
  saveStats(stats);
}

// ============ 告警 ============

function checkAlert(stats) {
  try {
    if (!fs.existsSync(ALERT_FILE)) return;
    const config = JSON.parse(fs.readFileSync(ALERT_FILE, 'utf-8'));
    if (!config.enabled) return;
    if (stats.errors >= (config.rules?.errorThreshold || 3)) {
      console.log('[ALERT] 错误次数过多:', stats.errors);
    }
  } catch (e) {}
}

// ============ 主采集函数 ============

async function fetchAll() {
  const results = [];
  const stats = { success: 0, errors: 0, articles: 0, startTime: Date.now(), bySource: {} };
  
  console.log('[Fetcher] 开始采集, 来源:', NEWS_SOURCES.length);
  
  for (const source of NEWS_SOURCES) {
    stats.bySource[source.name] = { articles: 0, errors: 0 };
    const urlsToFetch = [source.url, ...(source.subUrls || [])];
    
    for (const url of urlsToFetch) {
      try {
        const pageData = await fetchPage(url, ['markdown']);
        if (!pageData?.data?.markdown) { stats.errors++; stats.bySource[source.name].errors++; continue; }
        
        const domain = new URL(source.url).hostname;
        const articles = extractNewsLinks(pageData.data.markdown, domain);
        
        if (articles.length > 0) stats.success++;
        
        for (const article of articles.slice(0, 2)) {
          const articleData = await fetchPage(article.link, ['markdown']);
          let content = '';
          if (articleData?.data?.markdown) {
            content = articleData.data.markdown.replace(/^#.*$/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
              .replace(/!\[([^\]]*)\]\([^)]+\)/g, '').replace(/[\n\r]{3,}/g, '\n\n').trim().substring(0, 500);
          }
          results.push({ source: source.name, category: source.cat, title: article.title, link: article.link, content });
          stats.articles++;
          stats.bySource[source.name].articles++;
        }
      } catch (e) {
        stats.errors++;
        stats.bySource[source.name].errors++;
      }
    }
  }
  
  stats.duration = Date.now() - stats.startTime;
  recordStats(stats);
  checkAlert(stats);
  
  console.log('[Fetcher] 完成, 文章:', results.length, '耗时:', stats.duration + 'ms');
  
  return results;
}

// ============ 工具函数 ============

function toTextSummary(results) {
  const byCat = {};
  for (const r of results) {
    if (!byCat[r.category]) byCat[r.category] = [];
    byCat[r.category].push({ title: r.title, link: r.link, content: r.content?.substring(0, 200) + '...' || '' });
  }
  const names = { '财经': '💰 财经', '科技': '💻 科技', '综合': '📱 综合', '国际': '🌍 国际' };
  let text = '📰 新闻速览\n────────────────────\n\n';
  for (const [cat, items] of Object.entries(byCat)) {
    text += '【' + (names[cat] || cat) + '】\n';
    for (const item of items) {
      text += '• ' + item.title + '\n';
      if (item.content) text += '  ' + item.content + '\n';
      text += '  原文: ' + item.link + '\n\n';
    }
  }
  text += '────────────────────\n🕐 ' + new Date().toLocaleString('zh-CN');
  return text;
}

// ============ 导出 ============

module.exports = {
  fetchAll,
  toTextSummary,
  NEWS_SOURCES,
  loadStats
};
