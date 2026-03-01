/**
 * Web-Fetch Server - AI-powered web scraping with proxy support
 */

const http = require('http');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 8080;
const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

function fetchURL(url, timeout = 30000) {
  try {
    const timeoutSec = Math.floor(timeout / 1000);
    let cmd = `curl -s --max-time ${timeoutSec} -x "${PROXY}" -L "${url}"`;
    const data = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return { success: true, data: data, statusCode: 200 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function htmlToMarkdown(html) {
  let md = html || '';
  md = md.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
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
  md = md.replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, '*$1*');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&nbsp;/g, ' ');
  md = md.replace(/&amp;/g, '&');
  md = md.replace(/&lt;/g, '<');
  md = md.replace(/&gt;/g, '>');
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/\n{3,}/g, '\n\n');
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
    if (match[1].startsWith('http')) links.push(match[1]);
  }
  return [...new Set(links)];
}

async function scrape(url, options = {}) {
  const { formats = ['markdown'], timeout = 30000 } = options;
  const result = fetchURL(url, timeout);
  if (!result.success) return { success: false, error: result.error };
  
  const html = result.data;
  const response = { success: true, data: {} };
  
  response.data.metadata = { sourceURL: url, title: extractTitle(html) };
  
  for (const format of formats) {
    switch (format.toLowerCase()) {
      case 'markdown':
      case 'text': response.data.markdown = htmlToMarkdown(html); break;
      case 'html': response.data.html = html; break;
      case 'links': response.data.links = extractLinks(html); break;
    }
  }
  return response;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  
  const url = new URL(req.url, 'http://localhost:' + PORT);
  
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', proxy: PROXY }));
    return;
  }
  
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
  console.log('   Proxy: ' + PROXY);
  console.log('   POST /scrape with {"url":"..."}');
});
