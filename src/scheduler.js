/**
 * News Scheduler - 定时新闻采集
 * 包含中文新闻 + Reddit 热帖
 */

const { execSync } = require('child_process');
const fs = require('fs');

const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

// 中文新闻源 + Reddit
const NEWS_SOURCES = {
  sina_finance: { name: '新浪财经', url: 'https://finance.sina.com.cn/', category: '财经' },
  sina_stock: { name: '新浪股票', url: 'https://finance.sina.com.cn/stock/', category: '财经' },
  tencent_news: { name: '腾讯新闻', url: 'https://news.qq.com/', category: '综合' },
  ifeng: { name: '凤凰网', url: 'https://www.ifeng.com/', category: '综合' },
  huxiu: { name: '虎嗅', url: 'https://www.huxiu.com/', category: '科技' },
  kr36: { name: '36氪', url: 'https://www.36kr.com/', category: '科技' },
  bbc_cn: { name: 'BBC中文', url: 'https://www.bbc.com/zhongwen/simp', category: '国际' },
  reddit_popular: { name: 'Reddit Popular', url: 'https://www.reddit.com/r/popular/hot.json', category: 'Reddit', isJson: true },
  reddit_technology: { name: 'Reddit Technology', url: 'https://www.reddit.com/r/technology/hot.json', category: 'Reddit', isJson: true },
  reddit_programming: { name: 'Reddit Programming', url: 'https://www.reddit.com/r/programming/hot.json', category: 'Reddit', isJson: true }
};

function fetchURL(url) {
  try {
    const cmd = 'curl -s --max-time 20 -x "' + PROXY + '" -H "User-Agent: Mozilla/5.0" -L "' + url + '"';
    return { success: true, data: execSync(cmd, { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 }) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractChineseTitles(html) {
  const titles = [];
  const hRegex = /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi;
  let match;
  while ((match = hRegex.exec(html)) !== null) {
    let title = match[1].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 4 && title.length < 60 && !title.includes('&')) {
      titles.push(title);
    }
  }
  const aRegex = /<a[^>]*>([^<]{5,60})<\/a>/gi;
  while ((match = aRegex.exec(html)) !== null) {
    let title = match[1].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 4 && title.length < 60 && !title.includes('&')) {
      titles.push(title);
    }
  }
  return [...new Set(titles)].slice(0, 20);
}

function extractRedditTitles(jsonStr) {
  const titles = [];
  try {
    const data = JSON.parse(jsonStr);
    const children = data.data?.children || [];
    for (const item of children.slice(0, 10)) {
      const title = item.data?.title;
      if (title && title.length < 200) {
        titles.push(title);
      }
    }
  } catch (e) {}
  return titles;
}

function fetchNews(key) {
  const source = NEWS_SOURCES[key];
  if (!source) return { error: 'Unknown source' };
  
  console.log('Fetching: ' + source.name + '...');
  const result = fetchURL(source.url);
  
  if (!result.success) return { error: result.error };
  
  let titles = source.isJson ? extractRedditTitles(result.data) : extractChineseTitles(result.data);
  
  return { source: source.name, url: source.url, category: source.category, titles, count: titles.length };
}

function fetchAll() {
  const results = {};
  for (const key of Object.keys(NEWS_SOURCES)) {
    results[key] = fetchNews(key);
  }
  return results;
}

function formatForVoice(results) {
  let text = '各位听众朋友们大家好，今天的新闻摘要来了。';
  const cats = { '财经': '财经方面', '科技': '科技方面', '综合': '综合新闻', '国际': '国际方面', 'Reddit': ' Reddit热门' };
  
  for (const [key, data] of Object.entries(results)) {
    if (data.titles && data.titles.length > 0) {
      const catName = cats[data.category] || data.category;
      text += catName + '，';
      for (let i = 0; i < Math.min(5, data.titles.length); i++) {
        text += data.titles[i] + '。';
      }
    }
  }
  text += '以上就是今天的新闻摘要，谢谢收听。';
  return text;
}

function formatForTelegram(results) {
  let msg = '📰 新闻速览\n────────────────────\n\n';
  const cats = { '财经': '💰 财经', '科技': '💻 科技', '综合': '📱 综合', '国际': '🌍 国际', 'Reddit': '🔥 Reddit' };
  
  for (const [key, data] of Object.entries(results)) {
    if (data.error) {
      msg += '❌ ' + data.source + ': ' + data.error + '\n';
    } else if (data.titles && data.titles.length > 0) {
      const cat = cats[data.category] || '📰';
      msg += cat + ' ' + data.source + '\n';
      for (let i = 0; i < Math.min(5, data.titles.length); i++) {
        msg += '  • ' + data.titles[i] + '\n';
      }
      msg += '\n';
    }
  }
  msg += '────────────────────\n🕐 ' + new Date().toLocaleString('zh-CN');
  return msg;
}

// CLI
const cmd = process.argv[2];

if (cmd === 'voice') {
  console.log(formatForVoice(fetchAll()));
} else if (cmd === 'telegram') {
  console.log(formatForTelegram(fetchAll()));
} else if (cmd === 'both') {
  const results = fetchAll();
  console.log('=== 文字版 ===\n');
  console.log(formatForTelegram(results));
  console.log('\n=== 语音版 ===\n');
  console.log(formatForVoice(results));
} else if (cmd === 'fetch') {
  console.log(JSON.stringify(fetchAll(), null, 2));
} else if (cmd === 'list') {
  console.log('新闻源列表:');
  for (const [k, v] of Object.entries(NEWS_SOURCES)) {
    console.log('  ' + k + ': ' + v.name + ' (' + v.category + ')');
  }
} else {
  console.log('用法: node scheduler.js [voice|telegram|both|fetch|list]');
}
