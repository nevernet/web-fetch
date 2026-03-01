/**
 * Web-Fetch Server - Simple HTTP-based web scraper
 */

const http = require('http');
const https = require('https');
const { promisify } = require('util');

const PORT = process.env.PORT || 8080;

function fetchURL(url, timeout = 30000) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
      }
    }, (res) => {
      let data = Buffer.alloc(0);
      res.on('data', chunk => data = Buffer.concat([data, chunk]));
      res.on('end', () => {
        resolve({ 
          success: true, 
          data: data.toString('utf-8'),
          statusCode: res.statusCode,
          headers: res.headers
        });
      });
    });
    req.on('error', e => resolve({ success: false, error: e.message }));
    req.setTimeout(timeout, () => { req.destroy(); resolve({ success: false, error: 'timeout' }); });
  });
}

function htmlToMarkdown(html) {
  let md = html || '';
  
  // Remove script and style
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Basic conversions
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
  md = md.replace(/<div[^>]*>/gi, '\n');
  md = md.replace(/<\/div>/gi, '\n');
  
  // Remove remaining tags
  md = md.replace(/<[^>]+>/g, '');
  
  // Entities
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
  
  // Clean up
  md = md.replace(/\n{3,}/g, '\n\n');
  md = md.replace(/[ \t]+/g, ' ');
  
  return md.trim();
}

function extractTitle(html) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractLinks(html) {
  const links = [];
  const regex = /<a[^>]*href="([^"]+)"[^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith('http')) links.push(href);
  }
  return [...new Set(links)];
}

async function scrape(url, options = {}) {
  const { formats = ['markdown'], timeout = 30000 } = options;
  
  const result = await fetchURL(url, timeout);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  
  const html = result.data;
  const response = { success: true, data: {} };
  
  // Extract metadata
  response.data.metadata = {
    sourceURL: url,
    statusCode: result.statusCode,
    title: extractTitle(html)
  };
  
  // Get requested formats
  for (const format of formats) {
    switch (format.toLowerCase()) {
      case 'markdown':
      case 'text':
        response.data.markdown = htmlToMarkdown(html);
        break;
      case 'html':
        response.data.html = html;
        break;
      case 'links':
        response.data.links = extractLinks(html);
        break;
    }
  }
  
  return response;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  
  const url = new URL(req.url, 'http://localhost:' + PORT);
  
  // Health
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }
  
  // Scrape
  if (req.method === 'POST' && url.pathname === '/scrape') {
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
  
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, () => {
  console.log('🌐 Web-Fetch running on http://localhost:' + PORT);
  console.log('   POST /scrape with {"url":"..."}');
});
