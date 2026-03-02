require('dotenv').config();
/**
 * Web-Fetch Server - AI-powered web scraping for RAG
 * 支持缓存机制
 */

const http = require('http');
const { execSync } = require('child_process');

let playwright = null;
try { playwright = require('playwright'); } catch(e) {}

// 缓存模块
const cache = require('./cache');

const PORT = process.env.PORT || 8080;
const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'; // 默认启用缓存
const CACHE_TTL = parseInt(process.env.CACHE_TTL || '3600'); // 缓存1小时

let browser = null;
async function initPlaywright() {
  if (!playwright || browser) return browser;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  } catch(e) {}
  return browser;
}

function fetchByCurl(url, timeout) {
  timeout = timeout || 30000;
  try {
    const cmd = 'curl -s --max-time ' + Math.floor(timeout/1000) + ' -x "' + PROXY + '" -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" -L "' + url + '"';
    const data = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function fetchByPlaywright(url, timeout) {
  timeout = timeout || 30000;
  const b = await initPlaywright();
  if (!b) return null;
  let page;
  try {
    const context = await b.newContext({ proxy: { server: PROXY } });
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

function htmlToMarkdown(html) {
  if (!html) return '';
  let md = html;
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '\n');
  md = md.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '\n');
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n');
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n');
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '\n$1\n');
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1');
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
  md = md.replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, '**$1**');
  md = md.replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, '*$1*');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*>/gi, '![]($1)');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim().substring(0, 5000);
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractDescription(html) {
  const m = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
  return m ? m[1].trim() : '';
}

function extractLinks(html) {
  const links = [];
  // 匹配标准链接
  const regex = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    links.push(match[1]);
  }
  return [...new Set(links)].slice(0, 50);
}

function extractMainContent(html) {
  let content = html;
  content = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  content = content.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  content = content.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
  content = content.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  content = content.replace(/<[^>]+>/g, ' ');
  content = content.replace(/\s+/g, ' ').trim();
  content = content.replace(/&nbsp;/g, ' ');
  content = content.replace(/&amp;/g, '&');
  content = content.replace(/&lt;/g, '<');
  content = content.replace(/&gt;/g, '>');
  return content.substring(0, 3000);
}

async function scrape(url, options) {
  options = options || {};
  const formats = options.formats || ['markdown'];
  const timeout = options.timeout || 30000;
  const usePlaywright = options.playwright || false;
  const noCache = options.noCache || false;
  
  // 缓存键生成
  const cacheKey = cache.getCacheKey('scrape', { url, formats, timeout, usePlaywright });
  
  // 尝试从缓存获取
  if (CACHE_ENABLED && !noCache) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return { success: true, data: cachedData.data, fromCache: true };
    }
  }
  
  let result;
  let method = 'curl';
  
  if (usePlaywright || playwright) {
    const pwResult = await fetchByPlaywright(url, timeout);
    if (pwResult && pwResult.success) {
      result = pwResult;
      method = 'playwright';
    }
  }
  
  if (!result || !result.success) {
    result = fetchByCurl(url, timeout);
    method = 'curl';
  }
  
  if (!result.success) return { success: false, error: result.error };
  
  const html = result.data;
  const response = { success: true, data: {} };
  
  response.data.metadata = { sourceURL: url, title: extractTitle(html), description: extractDescription(html) };
  
  for (const fmt of formats) {
    const f = fmt.toLowerCase();
    if (f === 'markdown' || f === 'text') response.data.markdown = htmlToMarkdown(html);
    else if (f === 'html') response.data.html = html;
    else if (f === 'links') response.data.links = extractLinks(html);
  }
  response.data.method = method;
  
  // 缓存结果
  if (CACHE_ENABLED && !noCache) {
    cache.set(cacheKey, response, CACHE_TTL);
  }
  
  return response;
}

// Search - 使用 DuckDuckGo (更稳定的搜索结果)
async function search(query, options) {
  options = options || {};
  const limit = options.limit || 10;
  const includeContent = options.includeContent || false;
  const noCache = options.noCache || false;
  
  // 缓存键生成
  const cacheKey = cache.getCacheKey('search', { query, limit, includeContent });
  
  // 尝试从缓存获取
  if (CACHE_ENABLED && !noCache) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      return { success: true, data: cachedData.data, fromCache: true };
    }
  }
  
  // 使用 DuckDuckGo HTML 版本
  const searchURL = 'https://html.duckduckgo.com/html/?q=' + encodeURIComponent(query);
  const result = fetchByCurl(searchURL, 30000);
  if (!result.success) return { success: false, error: result.error };
  
  const html = result.data;
  
  // 提取搜索结果 - DuckDuckGo 格式
  const results = [];
  const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  
  const links = [];
  let match;
  while ((match = linkRegex.exec(html)) !== null) {
    // DuckDuckGo 使用 URL 跳转，需要解码
    let url = match[1];
    try {
      // 提取实际 URL
      const urlMatch = url.match(/uddg=([^&]+)/);
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1]);
      }
    } catch(e) {}
    if (url.startsWith('http')) {
      links.push(url);
    }
  }
  
  const snippets = [];
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
  }
  
  const batch = links.slice(0, limit);
  console.log('Search: fetching ' + batch.length + ' pages...');
  
  for (let i = 0; i < batch.length; i++) {
    try {
      const url = batch[i];
      const pageResult = fetchByCurl(url, 15000);
      if (!pageResult.success) continue;
      
      const pageHtml = pageResult.data;
      results.push({
        url: url,
        title: extractTitle(pageHtml) || (i < snippets.length ? snippets[i] : ''),
        description: extractDescription(pageHtml) || (i < snippets.length ? snippets[i] : ''),
        content: includeContent ? extractMainContent(pageHtml) : null
      });
    } catch (e) {
      continue;
    }
  }
  
  const response = {
    success: true,
    data: {
      query: query,
      results: results,
      total: results.length
    }
  };
  
  // 缓存结果
  if (CACHE_ENABLED && !noCache) {
    cache.set(cacheKey, response.data, CACHE_TTL);
  }
  
  return response;
}

async function extract(url, options) {
  const result = await scrape(url, { ...options, formats: ['markdown', 'html'] });
  if (!result.success) return { success: false, error: result.error };
  
  return {
    success: true,
    data: {
      sourceURL: url,
      extracted: {
        title: result.data.metadata.title,
        description: result.data.metadata.description,
        content: extractMainContent(result.data.html || ''),
        markdown: result.data.markdown
      }
    }
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const pathname = req.url.split('?')[0];
  
  if (pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ 
      status: 'ok', 
      playwright: !!playwright, 
      proxy: PROXY,
      cache: {
        enabled: CACHE_ENABLED,
        ttl: CACHE_TTL,
        status: cache.status()
      }
    }));
    return;
  }
  
  // 缓存管理接口
  if (pathname === '/cache/status') {
    res.writeHead(200);
    res.end(JSON.stringify(cache.status()));
    return;
  }
  
  if (pathname === '/cache/clear' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const p = JSON.parse(body);
        const key = p.key;
        if (key) {
          cache.clear(key);
        } else {
          cache.clearAll();
        }
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, status: cache.status() }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  if (req.method === 'POST' && pathname === '/scrape') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const p = JSON.parse(body);
        if (!p.url) throw new Error('url required');
        const r = await scrape(p.url, p.options || {});
        res.writeHead(200);
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  if (req.method === 'POST' && pathname === '/search') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const p = JSON.parse(body);
        if (!p.query) throw new Error('query required');
        const r = await search(p.query, p.options || {});
        res.writeHead(200);
        res.end(JSON.stringify(r));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  if (req.method === 'POST' && pathname === '/extract') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const p = JSON.parse(body);
        if (!p.url) throw new Error('url required');
        const r = await extract(p.url, p.options || {});
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
  res.end(JSON.stringify({ error: 'not found', available: ['/health', '/cache/status', '/cache/clear', '/scrape', '/search', '/extract'] }));
});

server.listen(PORT, () => {
  console.log('Web-Fetch running on http://localhost:' + PORT);
  console.log('Playwright: ' + (playwright ? '✅' : '❌'));
  console.log('Proxy: ' + PROXY);
  console.log('Cache: ' + (CACHE_ENABLED ? '✅ enabled (TTL: ' + CACHE_TTL + 's)' : '❌ disabled'));
});
