/**
 * News Scheduler - 定时新闻采集
 * 专门采集中文新闻
 */

const { execSync } = require('child_process');

const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

// 中文新闻源
const NEWS_SOURCES = {
  // 国内门户
  sina_finance: { name: '新浪财经', url: 'https://finance.sina.com.cn/', category: '财经' },
  sina_stock: { name: '新浪股票', url: 'https://finance.sina.com.cn/stock/', category: '财经' },
  tencent_news: { name: '腾讯新闻', url: 'https://news.qq.com/', category: '综合' },
  ifeng: { name: '凤凰网', url: 'https://www.ifeng.com/', category: '综合' },
  
  // 科技
  huxiu: { name: '虎嗅', url: 'https://www.huxiu.com/', category: '科技' },
  kr36: { name: '36氪', url: 'https://www.36kr.com/', category: '科技' },
  
  // 国际
  bbc_cn: { name: 'BBC中文', url: 'https://www.bbc.com/zhongwen/simp', category: '国际' }
};

function fetchURL(url) {
  try {
    const cmd = 'curl -s --max-time 20 -x "' + PROXY + '" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -L "' + url + '"';
    const data = execSync(cmd, { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 });
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractChineseTitles(html) {
  const titles = [];
  
  // 提取标题标签
  const hRegex = /<h[1-4][^>]*>([^<]+)<\/h[1-4]>/gi;
  let match;
  while ((match = hRegex.exec(html)) !== null) {
    let title = match[1].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 4 && title.length < 60 && !title.includes('&') && !title.includes(';')) {
      titles.push(title);
    }
  }
  
  // 提取普通链接标题
  const aRegex = /<a[^>]*>([^<]{5,60})<\/a>/gi;
  while ((match = aRegex.exec(html)) !== null) {
    let title = match[1].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 4 && title.length < 60 && !title.includes('&') && !title.includes(';')) {
      titles.push(title);
    }
  }
  
  // 去重
  return [...new Set(titles)].slice(0, 20);
}

function fetchNews(key) {
  const source = NEWS_SOURCES[key];
  if (!source) return { error: 'Unknown source' };
  
  console.log('Fetching: ' + source.name + '...');
  const result = fetchURL(source.url);
  
  if (!result.success) return { error: result.error };
  
  const titles = extractChineseTitles(result.data);
  
  return {
    source: source.name,
    url: source.url,
    category: source.category,
    titles: titles,
    count: titles.length,
    timestamp: new Date().toISOString()
  };
}

function fetchAll() {
  const results = {};
  for (const key of Object.keys(NEWS_SOURCES)) {
    results[key] = fetchNews(key);
  }
  return results;
}

function formatForVoice(results) {
  // 格式化语音播报 - 简洁中文
  let text = '各位听众朋友们大家好，今天的新闻摘要来了。';
  
  const cats = { '财经': '财经方面', '科技': '科技方面', '综合': '综合新闻', '国际': '国际方面' };
  
  for (const [key, data] of Object.entries(results)) {
    if (data.titles && data.titles.length > 0) {
      const catName = cats[data.category] || data.category;
      text += catName + '，';
      for (let i = 0; i < Math.min(3, data.titles.length); i++) {
        text += data.titles[i] + '。';
      }
    }
  }
  
  text += '以上就是今天的新闻摘要，谢谢收听。';
  
  return text;
}

function formatForTelegram(results) {
  let msg = '📰 新闻速览\n────────────────────\n\n';
  
  const cats = { '财经': '💰 财经', '科技': '💻 科技', '综合': '📱 综合', '国际': '🌍 国际' };
  
  for (const [key, data] of Object.entries(results)) {
    if (data.error) {
      msg += '❌ ' + data.source + ': ' + data.error + '\n';
    } else if (data.titles && data.titles.length > 0) {
      const cat = cats[data.category] || '📰';
      msg += cat + ' ' + data.source + '\n';
      for (let i = 0; i < Math.min(4, data.titles.length); i++) {
        msg += '  • ' + data.titles[i].substring(0, 40) + '\n';
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
} else if (cmd === 'fetch') {
  console.log(JSON.stringify(fetchAll(), null, 2));
} else if (cmd === 'list') {
  console.log('新闻源列表:');
  for (const [k, v] of Object.entries(NEWS_SOURCES)) {
    console.log('  ' + k + ': ' + v.name + ' (' + v.category + ')');
  }
} else {
  console.log('用法: node scheduler.js [voice|telegram|fetch|list]');
  console.log('  voice     - 语音播报格式');
  console.log('  telegram  - Telegram格式');
  console.log('  fetch    - JSON格式');
}
