/**
 * Web-Fetch Server - AI-powered web scraping
 * 支持: Scrape, Crawl, Search, Extract
 */

const http = require('http');
const { execSync } = require('child_process');

const PORT = process.env.PORT || 8080;
const PROXY = process.env.HTTP_PROXY || 'http://127.0.0.1:7890';

function fetchURL(url, timeout) {
  timeout = timeout || 30000;
  try {
    const timeoutSec = Math.floor(timeout / 1000);
    const cmd = 'curl -s --max-time ' + timeoutSec + ' -x "' + PROXY + '" -L "' + url + '"';
    const data = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    return { success: true, data: data, statusCode: 200 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

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

function extractDescription(html) {
  var match = html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i);
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

function scrape(url, options) {
  options = options || {};
  var formats = options.formats || ['markdown'];
  var timeout = options.timeout || 30000;
  
  var result = fetchURL(url, timeout);
  if (!result.success) return { success: false, error: result.error };
  
  var html = result.data;
  var response = { success: true, data: {} };
  
  response.data.metadata = { sourceURL: url, title: extractTitle(html), description: extractDescription(html) };
  
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
  return response;
}

function crawl(url, options) {
  options = options || {};
  var maxDepth = options.maxDepth || 2;
  var limit = options.limit || 20;
  var timeout = options.timeout || 30000;
  
  var visited = new Set();
  var results = [];
  var baseURL = new URL(url);
  
  function crawlPage(pageUrl, depth) {
    if (depth > maxDepth || results.length >= limit || visited.has(pageUrl)) return;
    visited.add(pageUrl);
    console.log('  Crawling [' + depth + ']: ' + pageUrl);
    
    var result = fetchURL(pageUrl, timeout);
    if (!result.success) {
      results.push({ url: pageUrl, error: result.error, success: false });
      return;
    }
    
    var html = result.data;
    results.push({
      url: pageUrl,
      title: extractTitle(html),
      markdown: htmlToMarkdown(html).substring(0, 3000),
      success: true
    });
    
    if (depth < maxDepth) {
      var links = extractLinks(html, pageUrl).slice(0, 5);
      for (var i = 0; i < links.length; i++) {
        var link = links[i];
        if (link.startsWith(baseURL.origin) && !visited.has(link)) {
          crawlPage(link, depth + 1);
        }
      }
    }
  }
  
  crawlPage(url, 0);
  return {
    success: true,
    data: {
      pages: results,
      stats: { total: results.length, success: results.filter(function(r) { return r.success; }).length }
    }
  };
}

function search(query, options) {
  options = options || {};
  var limit = options.limit || 10;
  
  var searchURL = 'https://www.bing.com/search?q=' + encodeURIComponent(query);
  var result = fetchURL(searchURL, 30000);
  if (!result.success) return { success: false, error: result.error };
  
  var links = extractLinks(result.data, searchURL).slice(0, limit);
  var resultsList = links.map(function(url) { return { url: url, title: url }; });
  
  return {
    success: true,
    data: { query: query, results: resultsList, total: links.length }
  };
}

function extract(url, options) {
  var result = fetchURL(url, 30000);
  if (!result.success) return { success: false, error: result.error };
  
  var html = result.data;
  return {
    success: true,
    data: {
      sourceURL: url,
      extracted: {
        title: extractTitle(html),
        description: extractDescription(html),
        links: extractLinks(html, url).slice(0, 20)
      }
    }
  };
}

var server = http.createServer(function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  
  var u = new URL(req.url, 'http://localhost:' + PORT);
  
  if (u.pathname === '/health') { res.writeHead(200); res.end(JSON.stringify({ status: 'ok', proxy: PROXY })); return; }
  
  if (req.method === 'POST' && u.pathname === '/scrape') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var p = JSON.parse(body);
        if (!p.url) throw new Error('url required');
        var r = scrape(p.url, p.options || {});
        res.writeHead(200); res.end(JSON.stringify(r));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false, error: e.message })); }
    });
    return;
  }
  
  if (req.method === 'POST' && u.pathname === '/crawl') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var p = JSON.parse(body);
        if (!p.url) throw new Error('url required');
        var r = crawl(p.url, p.options || {});
        res.writeHead(200); res.end(JSON.stringify(r));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false, error: e.message })); }
    });
    return;
  }
  
  if (req.method === 'POST' && u.pathname === '/search') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var p = JSON.parse(body);
        if (!p.query) throw new Error('query required');
        var r = search(p.query, p.options || {});
        res.writeHead(200); res.end(JSON.stringify(r));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false, error: e.message })); }
    });
    return;
  }
  
  if (req.method === 'POST' && u.pathname === '/extract') {
    var body = '';
    req.on('data', function(c) { body += c; });
    req.on('end', function() {
      try {
        var p = JSON.parse(body);
        if (!p.url) throw new Error('url required');
        var r = extract(p.url, p.options || {});
        res.writeHead(200); res.end(JSON.stringify(r));
      } catch (e) { res.writeHead(400); res.end(JSON.stringify({ success: false, error: e.message })); }
    });
    return;
  }
  
  res.writeHead(404);
  res.end(JSON.stringify({ error: 'not found', available: ['/health', '/scrape', '/crawl', '/search', '/extract'] }));
});

server.listen(PORT, function() {
  console.log('Web-Fetch running on http://localhost:' + PORT);
  console.log('Proxy: ' + PROXY);
  console.log('POST /scrape  - 单页面抓取');
  console.log('POST /crawl   - 网站爬取');
  console.log('POST /search  - 搜索');
  console.log('POST /extract - 结构化提取');
});
