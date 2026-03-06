/**
 * News Scheduler - 带正文提取
 */

const { execSync } = require('child_process');

const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

// 新闻源配置
const NEWS_SOURCES = [
  { name: '新浪新闻', url: 'https://news.sina.com.cn/', cat: '综合' },
  { name: '凤凰网', url: 'https://www.ifeng.com/', cat: '综合' },
  { name: '虎嗅', url: 'https://www.huxiu.com/', cat: '科技' },
  { name: '36氪', url: 'https://www.36kr.com/', cat: '科技' },
  { name: '腾讯新闻', url: 'https://news.qq.com/', cat: '综合' }
];

// jina.ai 提取正文
function fetchArticleText(url) {
  try {
    const cleanUrl = url.replace(/^https?:\/\//, '');
    const jinaUrl = 'https://r.jina.ai/http://' + cleanUrl;
    const cmd = 'curl -s --max-time 15 -x "' + PROXY + '" "' + jinaUrl + '"';
    const content = execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 });
    
    // 提取 Markdown 内容
    const lines = content.split('\n');
    let text = '';
    let inContent = false;
    for (const line of lines) {
      if (line.startsWith('Markdown Content:')) { inContent = true; continue; }
      if (inContent && line.trim() && !line.startsWith('#') && !line.startsWith('[')) {
        text += line.trim() + ' ';
        if (text.length > 1000) break;
      }
    }
    return text.trim();
  } catch (e) { return ''; }
}

function fetchURL(url) {
  try {
    const cmd = 'curl -s --max-time 15 -x "' + PROXY + '" "' + url + '"';
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 5 * 1024 * 1024 });
  } catch (e) { return ''; }
}

function extractArticles(html, sourceUrl) {
  const articles = [];
  
  // 提取链接
  const regex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>([^<]{10,60})<\/a>/gi;
  let m;
  while ((m = regex.exec(html)) !== null) {
    const link = m[1];
    const title = m[2].replace(/<[^>]+>/g, '').trim();
    
    // 过滤有效链接
    if (title.length > 8 && (link.includes('sina.com.cn') || link.includes('ifeng.com') || 
        link.includes('huxiu.com') || link.includes('36kr.com') || link.includes('qq.com'))) {
      articles.push({ title, link });
      if (articles.length >= 3) break;
    }
  }
  
  return articles;
}

function fetchAllWithContent() {
  const results = [];
  
  for (const s of NEWS_SOURCES) {
    console.log('采集: ' + s.name);
    const html = fetchURL(s.url);
    if (!html) continue;
    
    const articles = extractArticles(html, s.url);
    console.log('  找到 ' + articles.length + ' 篇文章');
    
    for (const article of articles) {
      console.log('  获取正文: ' + article.title.substring(0, 20));
      const content = fetchArticleText(article.link);
      results.push({
        source: s.name,
        category: s.cat,
        title: article.title,
        link: article.link,
        content: content
      });
    }
  }
  
  return results;
}

function summarize(results) {
  const byCat = {};
  for (const r of results) {
    if (!byCat[r.category]) byCat[r.category] = [];
    byCat[r.category].push({
      title: r.title,
      link: r.link,
      content: r.content ? r.content.substring(0, 200) + '...' : ''
    });
  }
  
  const names = { '财经': '💰 财经', '科技': '💻 科技', '综合': '📱 综合', '国际': '🌍 国际' };
  
  let text = '📰 新闻速览\n────────────────────\n\n';
  
  for (const [cat, items] of Object.entries(byCat)) {
    text += '【' + (names[cat] || cat) + '】\n';
    for (const item of items) {
      text += '• ' + item.title + '\n';
      if (item.content) {
        text += '  ' + item.content + '\n';
      }
      text += '  原文: ' + item.link + '\n\n';
    }
  }
  
  text += '────────────────────\n🕐 ' + new Date().toLocaleString('zh-CN');
  
  return text;
}

function toVoice(summary) {
  let text = '各位听众朋友们大家好，今天的新闻摘要来了。';
  const lines = summary.split('\n').filter(l => l.startsWith('•'));
  for (const line of lines.slice(0, 8)) {
    let t = line.replace('• ', '').replace(/原文:.*/, '').substring(0, 40);
    text += t + '。';
  }
  return text + '以上就是今天的新闻摘要，谢谢收听。';
}

// CLI
const cmd = process.argv[2];

console.log('开始采集...\n');
const results = fetchAllWithContent();
console.log('\n共 ' + results.length + ' 篇\n');

const summary = summarize(results);
const voice = toVoice(summary);

if (cmd === 'voice') {
  console.log(voice);
} else if (cmd === 'telegram') {
  console.log(summary);
} else if (cmd === 'both') {
  console.log(summary);
  console.log('\n=== 语音版 ===\n');
  console.log(voice);
} else {
  console.log(summary);
}
