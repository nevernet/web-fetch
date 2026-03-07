/**
 * Web-Fetch Complete Test Suite
 * Run: node tests/index.js
 */

const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8080';
const TIMEOUT = 60000;

// Colors
const C = { r: '\x1b[0m', g: '\x1b[32m', R: '\x1b[31m', Y: '\x1b[33m', B: '\x1b[34m', C: '\x1b[36m' };

function log(msg, color) {
  color = color || 'r';
  console.log(C[color] + msg + C.r);
}

function logS(t) { log('==================================================', 'B'); log('  ' + t, 'B'); log('==================================================', 'B'); }

function makeRequest(method, pathname, body, opts) {
  return new Promise(function(resolve, reject) {
    body = body || null;
    opts = opts || {};
    var url = new URL(pathname, BASE_URL);
    var req = http.request({
      hostname: url.hostname, 
      port: url.port, 
      path: url.pathname + url.search,
      method: method, 
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      timeout: opts.timeout || TIMEOUT
    }, function(res) {
      var d = ''; 
      res.on('data', function(c) { d += c; }); 
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, data: d, raw: true }); }
      });
    });
    req.on('error', reject); 
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    if (body) req.write(JSON.stringify(body)); 
    req.end();
  });
}

var results = { passed: 0, failed: 0, errors: [] };
function rec(n, p, e) {
  e = e || null;
  if (p) { results.passed++; log('  ✓ ' + n, 'g'); }
  else { results.failed++; log('  ✗ ' + n, 'R'); results.errors.push({ name: n, error: e ? e.message : null }); }
}

// ============ 1. Health Check ============
async function testHealth() {
  logS('1. Health Check');
  try { var r = await makeRequest('GET', '/health'); rec('Basic /health', r.status === 200 && r.data && r.data.status === 'ok'); }
  catch (e) { rec('Basic /health', false, e); }
  try { var r = await makeRequest('GET', '/health'); rec('Has proxy info', 'proxy' in r.data); }
  catch (e) { rec('Has proxy info', false, e); }
  try { var r = await makeRequest('GET', '/cache/status'); rec('Cache status', r.status === 200 && r.data && r.data.total !== undefined); }
  catch (e) { rec('Cache status', false, e); }
}

// ============ 2. Scrape Function ============
async function testScrape() {
  logS('2. Scrape Function');
  try { var r = await makeRequest('POST', '/scrape', { url: 'https://www.example.com', formats: ['markdown'] }); rec('Markdown', r.status === 200 && r.data && r.data.success && r.data.data && r.data.data.markdown); }
  catch (e) { rec('Markdown', false, e); }
  try { var r = await makeRequest('POST', '/scrape', { url: 'https://www.example.com', formats: ['html'] }); rec('HTML', r.status === 200 && r.data && r.data.success && r.data.data && r.data.data.html); }
  catch (e) { rec('HTML', false, e); }
  try { var r = await makeRequest('POST', '/scrape', { url: 'https://www.example.com', formats: ['links'] }); rec('Links', r.status === 200 && r.data && r.data.success && r.data.data && r.data.data.links && Array.isArray(r.data.data.links)); }
  catch (e) { rec('Links', false, e); }
  try { var r = await makeRequest('POST', '/scrape', { url: 'https://www.example.com', formats: ['markdown', 'html', 'links'] }); rec('Multi-format', r.status === 200 && r.data && r.data.data && r.data.data.markdown && r.data.data.html && r.data.data.links && Array.isArray(r.data.data.links)); }
  catch (e) { rec('Multi-format', false, e); }
  try { var r = await makeRequest('POST', '/scrape', { url: '' }); rec('Missing URL error', r.status === 400 || (r.data && !r.data.success)); }
  catch (e) { rec('Missing URL error', true); }
  try { var r = await makeRequest('POST', '/scrape', { url: 'not-valid' }); rec('Invalid URL', !r.data || !r.data.success || r.status >= 400); }
  catch (e) { rec('Invalid URL', true); }
}

// ============ 3. Search Function ============
async function testSearch() {
  logS('3. Search Function');
  try { var r = await makeRequest('POST', '/search', { query: 'JavaScript', options: { limit: 5 } }); rec('Basic search', r.status === 200 && r.data && r.data.success && r.data.data && r.data.data.results && r.data.data.results.length > 0); }
  catch (e) { rec('Basic search', false, e); }
  try { var r = await makeRequest('POST', '/search', { query: 'AI', options: { includeContent: true, limit: 3 } }); rec('With content', r.status === 200 && r.data && r.data.data && r.data.data.results && r.data.data.results.some(function(x) { return x.content; })); }
  catch (e) { rec('With content', false, e); }
  try { var r = await makeRequest('POST', '/search', { query: '' }); rec('Empty query', !r.data || !r.data.success || r.status >= 400); }
  catch (e) { rec('Empty query', true); }
  try { var r = await makeRequest('POST', '/search', { query: 'C++', options: { limit: 3 } }); rec('Special char (C++)', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Special char (C++)', false, e); }
  try { var r = await makeRequest('POST', '/search', { query: '中文', options: { limit: 3 } }); rec('Chinese query', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Chinese query', false, e); }
}

// ============ 4. Extract Function ============
async function testExtract() {
  logS('4. Extract Function');
  try { var r = await makeRequest('POST', '/extract', { url: 'https://www.example.com' }); rec('Basic extract', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Basic extract', false, e); }
  try { var r = await makeRequest('POST', '/extract', { url: 'https://www.example.com' }); rec('Title extract', r.data && r.data.data && r.data.data.extracted && r.data.data.extracted.title); }
  catch (e) { rec('Title extract', false, e); }
  try { var r = await makeRequest('POST', '/extract', { url: 'https://www.example.com' }); rec('Description extract', r.data && r.data.data && r.data.data.extracted && r.data.data.extracted.description !== undefined); }
  catch (e) { rec('Description extract', false, e); }
  try { var r = await makeRequest('POST', '/extract', { url: 'https://www.example.com' }); rec('Content extract', r.data && r.data.data && r.data.data.extracted && r.data.data.extracted.content); }
  catch (e) { rec('Content extract', false, e); }
  try { var r = await makeRequest('POST', '/extract', { url: 'https://www.example.com' }); rec('Site type', r.data && r.data.data && r.data.data.extracted && r.data.data.extracted.siteType); }
  catch (e) { rec('Site type', false, e); }
}

// ============ 5. Cache Function ============
async function testCache() {
  logS('5. Cache Function');
  try { var r = await makeRequest('GET', '/cache/status'); rec('Cache status query', r.status === 200 && r.data && r.data.total !== undefined); }
  catch (e) { rec('Cache status query', false, e); }
  try { var r = await makeRequest('POST', '/cache/clear', {}); rec('Clear all cache', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Clear all cache', false, e); }
  try { await makeRequest('POST', '/cache/clear', {}); await makeRequest('POST', '/scrape', { url: 'https://www.example.com', options: { noCache: false } }); var r2 = await makeRequest('POST', '/scrape', { url: 'https://www.example.com', options: { noCache: false } }); rec('Cache hit', r2.data && r2.data.fromCache === true); }
  catch (e) { rec('Cache hit', false, e); }
  try { var r = await makeRequest('POST', '/scrape', { url: 'https://www.example.com', options: { noCache: true } }); rec('Disable cache', r.data && r.data.fromCache !== true); }
  catch (e) { rec('Disable cache', false, e); }
}

// ============ 6. Reddit Function ============
async function testReddit() {
  logS('6. Reddit Function');
  try { var r = await makeRequest('GET', '/reddit/hot?subreddit=technology&limit=5'); rec('Reddit hot', r.status === 200 && r.data && r.data.success && r.data.data && r.data.data.posts && r.data.data.posts.length > 0); }
  catch (e) { rec('Reddit hot', false, e); }
  try { var r = await makeRequest('GET', '/reddit/hot'); rec('Reddit default', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Reddit default', false, e); }
  try { var r = await makeRequest('GET', '/reddit/search?q=AI&limit=3'); rec('Reddit search', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Reddit search', false, e); }
  try { var r = await makeRequest('GET', '/reddit/hot?subreddit=javascript&limit=3'); rec('Subreddit', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Subreddit', false, e); }
  try { var r = await makeRequest('GET', '/reddit/hot?limit=3'); rec('Limit', r.status === 200 && r.data && r.data.data && r.data.data.posts && r.data.data.posts.length <= 3); }
  catch (e) { rec('Limit', false, e); }
}

// ============ 7. Proxy Function ============
async function testProxy() {
  logS('7. Proxy Function');
  try { var r = await makeRequest('POST', '/scrape', { url: 'https://www.bbc.com/news', formats: ['markdown'], options: { timeout: 30000 } }); rec('BBC proxy', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('BBC proxy', false, e); }
  try { var r = await makeRequest('POST', '/scrape', { url: 'https://www.reuters.com', formats: ['markdown'], options: { timeout: 30000 } }); rec('Reuters proxy', r.status === 200 && r.data && r.data.success); }
  catch (e) { rec('Reuters proxy', false, e); }
  try { var r = await makeRequest('POST', '/extract', { url: 'https://www.bbc.com/news' }); rec('Extract title via proxy', r.data && r.data.data && r.data.data.extracted && r.data.data.extracted.title); }
  catch (e) { rec('Extract title via proxy', false, e); }
}

// ============ 8. Fetcher ============
async function testFetcher() {
  logS('8. News Fetcher');
  var fp = path.join(__dirname, '..', 'src', 'fetcher.js');
  try { var fs = require('fs'); rec('fetcher.js exists', fs.existsSync(fp)); }
  catch (e) { rec('fetcher.js exists', false, e); }
  try { 
    var p = new Promise(function(rs, rj) {
      var proc = spawn('node', [fp], { env: { FETCH_URL: BASE_URL } });
      var out = ''; 
      proc.stdout.on('data', function(d) { out += d; }); 
      proc.stderr.on('data', function(d) { out += d; });
      proc.on('close', function(c) { rs({ c: c, o: out }); }); 
      proc.on('error', rj); 
      setTimeout(function() { proc.kill(); rj(new Error('timeout')); }, 50000);
    }); 
    var r = await p; 
    rec('fetcher.js JSON mode', r.c === 0 && r.o.length > 0); 
  }
  catch (e) { rec('fetcher.js JSON mode', false, e); }
  try { 
    var p = new Promise(function(rs, rj) {
      var proc = spawn('node', [fp, 'list'], { env: { FETCH_URL: BASE_URL } });
      var out = ''; 
      proc.stdout.on('data', function(d) { out += d; }); 
      proc.on('close', function(c) { rs({ c: c, o: out }); }); 
      proc.on('error', rj); 
      setTimeout(function() { proc.kill(); rj(new Error('timeout')); }, 80000);
    }); 
    var r = await p; 
    rec('fetcher.js list mode', r.c === 0); 
  }
  catch (e) { rec('fetcher.js list mode', false, e); }
}

// ============ 9. Voice ============
async function testVoice() {
  logS('9. Voice Generation');
  var vp = path.join(__dirname, '..', 'src', 'voice.js');
  try { var fs = require('fs'); rec('voice.js exists', fs.existsSync(vp)); }
  catch (e) { rec('voice.js exists', false, e); }
  try { 
    var p = new Promise(function(rs, rj) {
      var c = spawn('node', [vp, 'Test News']);
      var out = ''; 
      c.stdout.on('data', function(d) { out += d; }); 
      c.on('close', function(code) { rs({ c: code, o: out }); }); 
      c.on('error', rj);
    }); 
    var r = await p; 
    rec('voice.js basic', r.c === 0 && r.o.length > 0); 
  }
  catch (e) { rec('voice.js basic', false, e); }
  try { 
    var p = new Promise(function(rs, rj) {
      var c = spawn('node', [vp, 'News Test']);
      var out = ''; 
      c.stdout.on('data', function(d) { out += d; }); 
      c.on('close', function(code) { rs({ c: code, o: out }); }); 
      c.on('error', rj);
    }); 
    var r = await p; 
    rec('voice.js intro', r.o.indexOf('各位听众') >= 0 || r.o.indexOf('大家好') >= 0); 
  }
  catch (e) { rec('voice.js intro', false, e); }
  try { 
    var p = new Promise(function(rs, rj) {
      var c = spawn('node', [vp, 'News Test']);
      var out = ''; 
      c.stdout.on('data', function(d) { out += d; }); 
      c.on('close', function(code) { rs({ c: code, o: out }); }); 
      c.on('error', rj);
    }); 
    var r = await p; 
    rec('voice.js ending', r.o.indexOf('谢谢收听') >= 0 || r.o.indexOf('以上是') >= 0); 
  }
  catch (e) { rec('voice.js ending', false, e); }
}

// ============ 10. Error Handling ============
async function testError() {
  logS('10. Error Handling');
  try { var r = await makeRequest('POST', '/scrape', { url: 'invalid-url' }); rec('Invalid URL', !r.data || !r.data.success || r.status >= 400); }
  catch (e) { rec('Invalid URL', true); }
  try { var r = await makeRequest('POST', '/scrape', {}); rec('Missing param', !r.data || !r.data.success || r.status >= 400); }
  catch (e) { rec('Missing param', true); }
  try { var r = await makeRequest('GET', '/nonexistent'); rec('404 endpoint', r.status === 404); }
  catch (e) { rec('404 endpoint', false, e); }
  try { var r = await makeRequest('POST', '/scrape', { url: 'not-valid' }); rec('Error format', r.data && (r.data.error || r.data.success === false)); }
  catch (e) { rec('Error format', false, e); }
}

// ============ 11. Concurrency ============
async function testConcurrency() {
  logS('11. Concurrency');
  try { 
    var promises = [
      makeRequest('POST', '/scrape', { url: 'https://www.example.com', options: { noCache: true } }), 
      makeRequest('POST', '/scrape', { url: 'https://www.example.org', options: { noCache: true } }), 
      makeRequest('POST', '/scrape', { url: 'https://www.example.net', options: { noCache: true } })
    ];
    var rs = await Promise.all(promises); 
    rec('Parallel scrape', rs.every(function(r) { return r.status === 200 && r.data && r.data.success; })); 
  }
  catch (e) { rec('Parallel scrape', false, e); }
  try { 
    var promises = [
      makeRequest('POST', '/search', { query: 'JS', options: { limit: 2 } }), 
      makeRequest('POST', '/search', { query: 'Python', options: { limit: 2 } }), 
      makeRequest('POST', '/search', { query: 'AI', options: { limit: 2 } })
    ];
    var rs = await Promise.all(promises); 
    rec('Parallel search', rs.every(function(r) { return r.status === 200 && r.data && r.data.success; })); 
  }
  catch (e) { rec('Parallel search', false, e); }
  try { 
    var promises = [
      makeRequest('GET', '/health'), makeRequest('GET', '/health'), makeRequest('GET', '/health'), 
      makeRequest('GET', '/health'), makeRequest('GET', '/health')
    ];
    var rs = await Promise.all(promises); 
    rec('High concurrency health', rs.every(function(r) { return r.status === 200 && r.data && r.data.status === 'ok'; })); 
  }
  catch (e) { rec('High concurrency health', false, e); }
  try { 
    var promises = [
      makeRequest('GET', '/health'), 
      makeRequest('GET', '/cache/status'), 
      makeRequest('POST', '/scrape', { url: 'https://www.example.com', options: { noCache: true } }), 
      makeRequest('POST', '/search', { query: 'test', options: { limit: 2 } })
    ];
    var rs = await Promise.all(promises); 
    rec('Mixed parallel', rs.every(function(r) { return r.status === 200 && r.data && r.data.success; })); 
  }
  catch (e) { rec('Mixed parallel', false, e); }
}

// ============ Main ============
async function run() {
  log('==================================================', 'C');
  log('    Web-Fetch Test Suite', 'C');
  log('==================================================', 'C');
  log('Base URL: ' + BASE_URL, 'C');
  
  results.startTime = Date.now();
  var tests = [
    { n: 'Health', f: testHealth },
    { n: 'Scrape', f: testScrape },
    { n: 'Search', f: testSearch },
    { n: 'Extract', f: testExtract },
    { n: 'Cache', f: testCache },
    { n: 'Reddit', f: testReddit },
    { n: 'Proxy', f: testProxy },
    { n: 'Fetcher', f: testFetcher },
    { n: 'Voice', f: testVoice },
    { n: 'Error', f: testError },
    { n: 'Concurrency', f: testConcurrency },
  ];
  
  for (var i = 0; i < tests.length; i++) {
    var t = tests[i];
    try { await t.f(); } 
    catch (e) { log('Error in ' + t.n + ': ' + e.message, 'R'); results.failed++; }
  }
  
  var dur = ((Date.now() - results.startTime) / 1000).toFixed(2);
  log('\n==================================================', 'C');
  log('    Results', 'C');
  log('==================================================', 'C');
  log('  Passed: ' + results.passed + ' | Failed: ' + results.failed, results.failed === 0 ? 'g' : 'R');
  log('  Time: ' + dur + 's', 'C');
  if (results.errors.length) { 
    log('\nFailed tests:', 'R'); 
    for (var j = 0; j < results.errors.length; j++) {
      var e = results.errors[j];
      log('  ' + (j+1) + '. ' + e.name + ': ' + e.error, 'R');
    }
  }
  log('\n==================================================', 'C');
  process.exit(results.failed > 0 ? 1 : 0);
}

run();
