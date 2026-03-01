/**
 * News Scheduler - 定时新闻采集
 * 支持 Reddit(通过搜索), 科技/新闻网站
 */

const { execSync } = require('child_process');

const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

const NEWS_SOURCES = {
  // 国外新闻
  bbc: { name: 'BBC News', url: 'https://www.bbc.com/news', category: 'world' },
  reuters: { name: 'Reuters', url: 'https://www.reuters.com', category: 'world' },
  techcrunch: { name: 'TechCrunch', url: 'https://techcrunch.com/', category: 'tech' },
  verge: { name: 'The Verge', url: 'https://www.theverge.com/', category: 'tech' },
  
  // AI 新闻
  openai: { name: 'OpenAI Blog', url: 'https://openai.com/blog', category: 'ai' },
  anthropic: { name: 'Anthropic', url: 'https://www.anthropic.com', category: 'ai' },
  
  // 国内新闻
  huxiu: { name: '虎嗅', url: 'https://www.huxiu.com/', category: 'tech' },
  kr36: { name: '36氪', url: 'https://www.36kr.com/', category: 'tech' },
  wangyi: { name: '网易新闻', url: 'https://news.163.com/', category: 'domestic' }
};

function fetchURL(url) {
  try {
    const cmd = 'curl -s --max-time 30 -x "' + PROXY + '" -L -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "' + url + '"';
    const data = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function extractRedditFromSearch(html) {
  const posts = [];
  
  // 从搜索结果提取 Reddit 链接
  const redditRegex = /<a[^>]*href="(https?:\/\/[^"]*reddit\.com[^"]*)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  while ((match = redditRegex.exec(html)) !== null) {
    const title = match[2].replace(/<[^>]+>/g, '').trim();
    if (title && title.length > 5 && !title.includes('reddit')) {
      posts.push(title);
    }
  }
  
  return [...new Set(posts)].slice(0, 10);
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

// Reddit 热门话题 - 通过 Bing 搜索
function fetchReddit() {
  console.log('Fetching: Reddit (via Bing)...');
  
  // 搜索 Reddit 热门
  const searchQueries = [
    'site:reddit.com trending today',
    'site:reddit.com r/technology top',
    'site:reddit.com r/artificial top'
  ];
  
  const allPosts = [];
  
  for (const query of searchQueries) {
    const searchURL = 'https://www.bing.com/search?q=' + encodeURIComponent(query);
    const result = fetchURL(searchURL);
    
    if (result.success) {
      const posts = extractRedditFromSearch(result.data);
      allPosts.push(...posts);
    }
  }
  
  return {
    source: 'Reddit',
    url: 'https://www.reddit.com/',
    category: 'social',
    titles: [...new Set(allPosts)].slice(0, 15),
    count: [...new Set(allPosts)].length,
    timestamp: new Date().toISOString()
  };
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
  
  // 添加 Reddit
  results['reddit'] = fetchReddit();
  
  return results;
}

function formatTelegram(results) {
  let msg = '📰 全球新闻速览\n────────────────────\n\n';
  
  const cats = { world: '🌍 国际', tech: '💻 科技', ai: '🤖 AI', domestic: '🇨🇳 国内', social: '📱 Reddit' };
  
  for (const [key, data] of Object.entries(results)) {
    if (data.error) {
      msg += '❌ ' + (data.source || key) + ': ' + data.error + '\n';
    } else if (data.titles && data.titles.length > 0) {
      const cat = cats[data.category] || '📰';
      msg += cat + ' ' + data.source + '\n';
      for (let i = 0; i < Math.min(5, data.titles.length); i++) {
        const title = data.titles[i].substring(0, 50);
        msg += '  • ' + title + '\n';
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
  console.log('  reddit: Reddit (via Bing)');
} else if (cmd === 'fetch') {
  console.log(JSON.stringify(fetchAll(arg || 'all'), null, 2));
} else if (cmd === 'telegram') {
  console.log(formatTelegram(fetchAll(arg || 'all')));
} else if (cmd === 'reddit') {
  console.log(formatTelegram({ reddit: fetchReddit() }));
} else if (cmd === 'ai') {
  const results = {
    openai: fetchNews('openai'),
    anthropic: fetchNews('anthropic')
  };
  console.log(formatTelegram(results));
} else if (cmd === 'watch') {
  const interval = parseInt(arg) || 60000;
  console.log('启动新闻监控，间隔: ' + interval + 'ms');
  setInterval(() => {
    console.log('\n=== ' + new Date().toISOString() + ' ===');
    console.log(formatTelegram(fetchAll('all')));
  }, interval);
} else {
  console.log('用法: node scheduler.js [list|fetch|telegram|reddit|ai|watch] [params]');
}
