/**
 * News Fetcher - 新闻采集脚本 (v2.4 - 告警机制)
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();

const FETCH_URL = process.env.FETCH_URL || 'http://localhost:8080';
const FETCH_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;
const LOG_DIR = path.join(PROJECT_ROOT, 'logs');
const STATS_FILE = path.join(LOG_DIR, 'stats.json');
const ALERT_CONFIG_FILE = path.join(LOG_DIR, 'alert.json');

if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ============ 告警配置 ============

function loadAlertConfig() {
  try {
    if (fs.existsSync(ALERT_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(ALERT_CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {}
  return {
    enabled: false,
    telegram: { enabled: false, chatId: '' },
    feishu: { enabled: false, webhook: '' },
    rules: {
      errorThreshold: 3,      // 错误次数超过阈值告警
      successRateThreshold: 50, // 成功率低于50%告警
      noDataThreshold: true   // 无数据时告警
    }
  };
}

function saveAlertConfig(config) {
  fs.writeFileSync(ALERT_CONFIG_FILE, JSON.stringify(config, null, 2));
}

class AlertManager {
  constructor() {
    this.config = loadAlertConfig();
  }

  async sendTelegram(message) {
    if (!this.config.telegram?.enabled || !this.config.telegram.chatId) return;
    // Telegram 告警逻辑 (需要 bot token)
    console.log('[ALERT-TG]', message);
  }

  async sendFeishu(message) {
    if (!this.config.feishu?.enabled || !this.config.feishu.webhook) return;
    // 飞书告警逻辑
    console.log('[ALERT-FEISHU]', message);
  }

  async send(message, details = {}) {
    if (!this.config.enabled) return;
    
    const fullMessage = `🔔 ${message}`;
    console.log('\n⚠️ 告警:', fullMessage);
    if (Object.keys(details).length) {
      console.log('  详情:', JSON.stringify(details));
    }
    
    await this.sendTelegram(fullMessage);
    await this.sendFeishu(fullMessage);
  }

  async checkAndAlert(stats) {
    if (!this.config.enabled) return;
    
    const rules = this.config.rules;
    
    // 检查错误阈值
    if (rules.errorThreshold && stats.errors >= rules.errorThreshold) {
      await this.send(`错误次数过多!`, { 错误数: stats.errors, 阈值: rules.errorThreshold });
    }
    
    // 检查成功率
    const total = stats.success + stats.errors;
    const rate = total > 0 ? (stats.success / total * 100).toFixed(1) : 0;
    if (rules.successRateThreshold && parseFloat(rate) < rules.successRateThreshold) {
      await this.send(`成功率过低!`, { 成功率: rate + '%', 阈值: rules.successRateThreshold + '%' });
    }
    
    // 检查无数据
    if (rules.noDataThreshold && stats.articles === 0) {
      await this.send('未采集到任何文章!', stats);
    }
  }
}

const alertManager = new AlertManager();

// ============ 日志系统 ============

const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
const CURRENT_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'];

class Logger {
  constructor(name) {
    this.name = name;
    this.logFile = path.join(LOG_DIR, `${name}.log`);
  }

  format(level, message, data = null) {
    const timestamp = new Date().toISOString();
    let log = `[${timestamp}] [${level}] ${message}`;
    if (data) log += ' ' + JSON.stringify(data);
    return log;
  }

  write(level, message, data = null) {
    if (LOG_LEVELS[level] <= CURRENT_LEVEL) {
      const line = this.format(level, message, data);
      console.log(line);
      try { fs.appendFileSync(this.logFile, line + '\n'); } catch (e) {}
    }
  }

  error(msg, data) { this.write('ERROR', msg, data); }
  warn(msg, data) { this.write('WARN', msg, data); }
  info(msg, data) { this.write('INFO', msg, data); }
  debug(msg, data) { this.write('DEBUG', msg, data); }
}

const logger = new Logger('fetcher');

process.on('uncaughtException', (err) => {
  logger.error('未捕获异常', { message: err.message, stack: err.stack });
  alertManager.send('服务崩溃!', { error: err.message });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('未处理Promise拒绝', { reason: String(reason) });
  alertManager.send('未处理Promise拒绝', { reason: String(reason) });
});

// ============ 监控统计系统 ============

class Monitor {
  constructor() {
    this.stats = this.loadStats();
    this.sessionStart = Date.now();
  }

  loadStats() {
    try {
      if (fs.existsSync(STATS_FILE)) {
        return JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
      }
    } catch (e) {}
    return { totalRuns: 0, totalArticles: 0, totalErrors: 0, totalTimeMs: 0, lastRun: null, bySource: {} };
  }

  saveStats() {
    try { fs.writeFileSync(STATS_FILE, JSON.stringify(this.stats, null, 2)); } 
    catch (e) { logger.error('保存统计失败', { error: e.message }); }
  }

  record(sessionStats) {
    this.stats.totalRuns++;
    this.stats.totalArticles += sessionStats.articles;
    this.stats.totalErrors += sessionStats.errors;
    this.stats.totalTimeMs += sessionStats.duration;
    this.stats.lastRun = new Date().toISOString();
    
    if (sessionStats.bySource) {
      for (const [source, data] of Object.entries(sessionStats.bySource)) {
        if (!this.stats.bySource[source]) this.stats.bySource[source] = { runs: 0, articles: 0, errors: 0 };
        this.stats.bySource[source].runs++;
        this.stats.bySource[source].articles += data.articles || 0;
        this.stats.bySource[source].errors += data.errors || 0;
      }
    }
    this.saveStats();
  }

  getReport() {
    const avgTime = this.stats.totalRuns > 0 ? (this.stats.totalTimeMs / this.stats.totalRuns / 1000).toFixed(1) : 0;
    const avgArticles = this.stats.totalRuns > 0 ? (this.stats.totalArticles / this.stats.totalRuns).toFixed(1) : 0;
    const successRate = this.stats.totalRuns > 0 ? ((1 - this.stats.totalErrors / this.stats.totalRuns) * 100).toFixed(1) : 100;
    return {
      summary: { 总运行次数: this.stats.totalRuns, 总采集文章: this.stats.totalArticles, 总错误数: this.stats.totalErrors, 平均耗时: avgTime + 's', 平均文章数: avgArticles, 成功率: successRate + '%', 最后运行: this.stats.lastRun || '无' },
      bySource: this.stats.bySource
    };
  }

  printReport() {
    const report = this.getReport();
    console.log('\n📊 ===== 监控面板 =====');
    console.log('────────────────────');
    for (const [k, v] of Object.entries(report.summary)) console.log(`  ${k}: ${v}`);
    console.log('────────────────────');
    console.log('📈 各来源统计:');
    for (const [source, data] of Object.entries(report.bySource)) console.log(`  ${source}: ${data.articles} 篇, ${data.errors} 错误`);
    console.log('=======================\n');
  }
}

const monitor = new Monitor();

// ============ 配置 ============

const NEWS_SOURCES = [
  { name: '新浪新闻', url: 'https://news.sina.com.cn/', cat: '综合', subUrls: ['https://news.sina.com.cn/china/', 'https://news.sina.com.cn/world/'] },
  { name: '凤凰网', url: 'https://www.ifeng.com/', cat: '综合', subUrls: ['https://news.ifeng.com/'] },
  { name: '虎嗅', url: 'https://www.huxiu.com/', cat: '科技', subUrls: ['https://www.huxiu.com/article/'] },
  { name: '36氪', url: 'https://www.36kr.com/', cat: '科技', subUrls: ['https://www.36kr.com/news/'] },
  { name: '腾讯新闻', url: 'https://news.qq.com/', cat: '综合', subUrls: ['https://news.qq.com/gn.htm', 'https://news.qq.com/gj.htm'] }
];

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

class FetchError extends Error {
  constructor(message, type) { super(message); this.name = 'FetchError'; this.type = type; }
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ============ HTTP 请求 ============

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, FETCH_URL);
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
      logger.warn(`重试 ${attempt}/${MAX_RETRIES}: ${e.message}`, { url });
      await delay(RETRY_DELAY * attempt);
      return fetchWithRetry(url, formats, attempt + 1);
    }
    throw e;
  }
}

async function fetchPage(url, formats = ['markdown']) {
  try { return await fetchWithRetry(url, formats); }
  catch (e) { logger.error(`抓取失败: ${e.message}`, { url }); return null; }
}

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
      if (title.length > 6 && (link.includes(domain) || domain.includes('qq.com')) && !link.includes('javascript') && !link.includes('void') && !link.includes('login')) {
        if (!links.find(l => l.link === link)) links.push({ title, link });
      }
      if (links.length >= 5) break;
    }
    if (links.length > 0) break;
  }
  return links;
}

// ============ 主采集逻辑 ============

async function fetchAllNews() {
  const results = [];
  const stats = { success: 0, errors: 0, articles: 0, startTime: Date.now(), bySource: {} };
  
  logger.info('开始采集', { sources: NEWS_SOURCES.length, url: FETCH_URL });
  
  for (const source of NEWS_SOURCES) {
    stats.bySource[source.name] = { articles: 0, errors: 0 };
    logger.info(`采集: ${source.name}`, { url: source.url });
    const urlsToFetch = [source.url, ...(source.subUrls || [])];
    
    for (const url of urlsToFetch) {
      logger.debug(`抓取页面: ${url}`);
      try {
        const pageData = await fetchPage(url, ['markdown']);
        if (!pageData?.data?.markdown) { stats.errors++; stats.bySource[source.name].errors++; continue; }
        
        const domain = new URL(source.url).hostname;
        const articles = extractNewsLinks(pageData.data.markdown, domain);
        logger.info(`找到 ${articles.length} 篇文章`, { url });
        
        if (articles.length > 0) stats.success++;
        
        for (const article of articles.slice(0, 2)) {
          const articleData = await fetchPage(article.link, ['markdown']);
          let content = '';
          if (articleData?.data?.markdown) {
            content = articleData.data.markdown.replace(/^#.*$/gm, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/!\[([^\]]*)\]\([^)]+\)/g, '').replace(/[\n\r]{3,}/g, '\n\n').trim().substring(0, 500);
          }
          results.push({ source: source.name, category: source.cat, title: article.title, link: article.link, content });
          stats.articles++;
          stats.bySource[source.name].articles++;
        }
      } catch (e) {
        stats.errors++;
        stats.bySource[source.name].errors++;
        logger.error(`采集错误: ${e.message}`, { url });
      }
    }
  }
  
  stats.duration = Date.now() - stats.startTime;
  logger.info('采集完成', stats);
  
  // 告警检查
  await alertManager.checkAndAlert(stats);
  
  return { results, stats };
}

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

async function main() {
  const cmd = process.argv[2];
  
  // 打印历史统计
  if (cmd === 'stats') {
    monitor.printReport();
    return;
  }
  
  // 配置告警
  if (cmd === 'alert-config') {
    console.log('当前告警配置:');
    console.log(JSON.stringify(alertManager.config, null, 2));
    return;
  }
  
  logger.info('==== 新闻采集开始 ====');
  
  const { results, stats } = await fetchAllNews();
  
  monitor.record(stats);
  
  logger.info('==== 完成 ====', { articles: results.length });
  
  monitor.printReport();
  
  if (cmd === 'text') console.log(toTextSummary(results));
  else if (cmd === 'list') console.log(results.map(r => '• ' + r.title + ' (' + r.source + ')').join('\n'));
  else console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { logger.error('严重错误', { message: e.message }); alertManager.send('严重错误', { error: e.message }); process.exit(1); });
