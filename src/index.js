/**
 * Web-Fetch Server - AI-powered web scraping
 * 支持: Scrape(Curl+Playwright), Crawl, Search, Extract
 */

const http = require('http');
const { execSync } = require('child_process');
let playwright = null;
let browser = null;

// 尝试加载 Playwright
try {
  playwright = require('playwright');
} catch(e) {
  console.log('Playwright not available, using curl only');
}

const PORT = process.env.PORT || 8080;
const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

// 初始化 Playwright
async function initPlaywright() {
  if (!playwright) return null;
  try {
    if (!browser) {
      browser = await playwright.chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return browser;
  } catch(e) {
    console.log('Playwright init failed:', e.message);
    return null;
  }
}

// Curl 方式抓取
function fetchByCurl(url, timeout) {
  timeout = timeout || 30000;
  try {
    const cmd = 'curl -s --max-time ' + Math.floor(timeout/1000) + ' -x "' + PROXY + '" -L "' + url + '"';
    const data = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return { success: true, data: data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Playwright 方式抓取
async function fetchByPlaywright(url, timeout) {
  timeout = timeout || 30000;
  const b = await initPlaywright();
  if (!b) return null;
  
  let page;
  try {
    const context = await b.newContext({
      proxy: { server: PROXY }
    });
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(2000);
    const content = await page.content();
    await context.close();
    return { success: true, data: content };
  } catch(e) {
    if (page) await page.close();
    return { success: false, error: e.message };
  }
}

// HTML 转 Markdown
function htmlToMarkdown(html) {
  if (!html) return '';
  let md = html;
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '\n');
  md = md.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '\n');
  md = md.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '\n');
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#(\d+);/g, function(_, n) { return String.fromCharCode(n); });
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

function extractTitle(html) {
  var match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractLinks(html, baseURL) {
  var links = [];
  var regex = /<a[^>]*href="([^"]+)"[^>]*>/gi;
  var match;
  try {
    var base = new URL(baseURL);
    while ((match = regex.exec(html)) !== null) {
      var href = match[1];
      if (href.startsWith('http')) links.push(href);
      else if (href.startsWith('/')) links.push(base.origin + href);
    }
  } catch (e) {}
  return [...new Set(links)];
}

// Scrape API
async function scrape(url, options) {
  options = options || {};
  var formats = options.formats || ['markdown'];
  var timeout = options.timeout || 30000;
  var usePlaywright = options.playwright || false;
  
  // 优先尝试 Playwright
  if (usePlaywright || playwright) {
    var pwResult = await fetchByPlaywright(url, timeout);
    if (pwResult && pwResult.success) {
      var html = pwResult.data;
      var response = { success: true, data: {} };
      response.data.metadata = { sourceURL: url, title: extractTitle(html) };
      for (var i = 0; i < formats.length; i++) {
        var format = formats[i].toLowerCase();
        if (format === 'markdown' || format === 'text') {
          response.data.markdown = htmlToMarkdown(html);
        } else if (format === 'html') {
          response.data.html = html;
        } else if (format === 'links') {
          response.data.links = extractLinks(html, url);
        }
      }
      response.data.method = 'playwright';
      return response;
    }
  }
  
  // 回退到 curl
  var result = fetchByCurl(url, timeout);
  if (!result.success) return { success: false, error: result.error };
  
  var html = result.data;
  var response = { success: true, data: {} };
  response.data.metadata = { sourceURL: url, title: extractTitle(html) };
  
  for (var i = 0; i < formats.length; i++) {
    var format = formats[i].toLowerCase();
    if (format === 'markdown' || format === 'text') {
      response.data.markdown = htmlToMarkdown(html);
    } else if (format === 'html') {
      response.data.html = html;
    } else if (format === 'links') {
      response.data.links = extractLinks(html, url);
    }
  }
  response.data.method = 'curl';
  return response;
}

// HTTP Server
var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  
  var u = new URL(req.url, 'http://localhost:' + PORT);
  
  if (u.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', playwright: !!playwright, proxy: PROXY }));
    return;
  }
  
  if (req.method === 'POST' && u.pathname === '/scrape') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', async function() {
      try {
        var p = JSON.parse(body);
        if (!p.url) throw new Error('url required');
        var r = await scrape(p.url, p.options || {});
        res.writeHead(200);
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found', available: ['/health', '/scrape'] }));
});

server.listen(PORT, function() {
  console.log('Web-Fetch running on http://localhost:' + PORT);
  console.log('Playwright: ' + (playwright ? '✅' : '❌'));
  console.log('Proxy: ' + PROXY);
});
