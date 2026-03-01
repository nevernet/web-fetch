/**
 * News Scheduler - 定时新闻采集
 */

const { execSync } = require('child_process');

const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

const NEWS_SOURCES = {
  bbc: { name: 'BBC News', url: 'https://www.bbc.com/news', category: 'world' },
  reuters: { name: 'Reuters', url: 'https://www.reuters.com', category: 'world' },
  techcrunch: { name: 'TechCrunch', url: 'https://techcrunch.com/', category: 'tech' },
  verge: { name: 'The Verge', url: 'https://www.theverge.com/', category: 'tech' },
  huxiu: { name: '虎嗅', url: 'https://www.huxiu.com/', category: 'tech' },
  kr36: { name: '36氪', url: 'https://www.36kr.com/', category: 'tech' },
  wangyi: { name: '网易新闻', url: 'https://news.163.com/', category: 'domestic' }
};

function fetchURL(url) {
  try {
    const cmd = 'curl -s --max-time 30 -x "' + PROXY + '" -L "' + url + '"';
    const data = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return { success: true, data: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractHeadlines(html) {
  const headlines = [];
  
  // 提取 h1, h2, h3 标题
  const hRegex = /<h[1-3][^>]*>([^<]+)<\/h[1-3]>/gi;
  let match;
  while ((match = hRegex.exec(html)) !== null) {
    const title = match[1].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 10 && title.length < 150) {
      headlines.push(title);
    }
  }
  
  // 提取链接标题
  const aRegex = /<a[^>]*title="([^"]*)"[^>]*>/gi;
  while ((match = aRegex.exec(html)) !== null) {
    const title = match[1].trim();
    if (title && title.length > 10 && title.length < 150) {
      headlines.push(title);
    }
  }
  
  return [...new Set(headlines)].slice(0, 15);
}

function fetchNews(key) {
  const source = NEWS_SOURCES[key];
  if (!source) return { error: 'Unknown source' };
  
  console.log('Fetching: ' + source.name + '...');
  const result = fetchURL(source.url);
  
  if (!result.success) return { error: result.error };
  
  const titles = extractHeadlines(result.data);
  return {
    source: source.name,
    url: source.url,
    category: source.category,
    titles: titles,
    count: titles.length,
    timestamp: new Date().toISOString()
  };
}

function fetchAll(categories) {
  const results = {};
  const keys = categories === 'all' ? Object.keys(NEWS_SOURCES) : categories.split(',');
  
  for (const key of keys) {
    if (NEWS_SOURCES[key]) {
      results[key] = fetchNews(key);
    }
  }
  return results;
}

function formatTelegram(results) {
  let msg = '📰 全球新闻速览\n────────────────────\n\n';
  
  const cats = { world: '🌍 国际', tech: '💻 科技', domestic: '🇨🇳 国内' };
  
  for (const [key, data] of Object.entries(results)) {
    if (data.error) {
      msg += '❌ ' + (data.source || key) + ': ' + data.error + '\n';
    } else if (data.titles && data.titles.length > 0) {
      const cat = cats[data.category] || '📰';
      msg += cat + ' ' + data.source + '\n';
      for (let i = 0; i < Math.min(5, data.titles.length); i++) {
        msg += '  • ' + data.titles[i].substring(0, 50) + '\n';
      }
      msg += '\n';
    }
  }
  
  msg += '────────────────────\n🕐 ' + new Date().toLocaleString('zh-CN');
  return msg;
}

const cmd = process.argv[2];
const arg = process.argv[3];

if (cmd === 'list') {
  console.log('新闻源列表:');
  for (const [k, v] of Object.entries(NEWS_SOURCES)) {
    console.log('  ' + k + ': ' + v.name + ' (' + v.category + ')');
  }
} else if (cmd === 'fetch') {
  console.log(JSON.stringify(fetchAll(arg || 'all'), null, 2));
} else if (cmd === 'telegram') {
  console.log(formatTelegram(fetchAll(arg || 'all')));
} else if (cmd === 'watch') {
  const interval = parseInt(arg) || 60000;
  console.log('启动新闻监控，间隔: ' + interval + 'ms');
  setInterval(() => {
    console.log('\n=== ' + new Date().toISOString() + ' ===');
    console.log(formatTelegram(fetchAll('all')));
  }, interval);
} else {
  console.log('用法: node scheduler.js [list|fetch|telegram|watch] [params]');
}
