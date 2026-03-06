/**
 * 自适应抓取策略模块
 * 根据网站响应自动调整抓取策略
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

// ============ User-Agent 轮换池 ============
const USER_AGENTS = [
  // Chrome (Windows)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Chrome (Mac)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox (Windows)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Firefox (Mac)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari (Mac)
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  // Edge (Windows)
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  // Chrome (Linux)
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

let uaIndex = 0;
function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function getNextUA() {
  uaIndex = (uaIndex + 1) % USER_AGENTS.length;
  return USER_AGENTS[uaIndex];
}

// ============ 网站特定配置 ============
const SITE_CONFIGS = {
  // 社交媒体
  'reddit.com': {
    priority: 'api',
    methods: ['api', 'curl', 'playwright'],
    delay: 1000,
    timeout: 30000,
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    rateLimitRetries: 3,
    fallbackToOld: true,
  },
  'twitter.com': {
    priority: 'playwright',
    methods: ['playwright', 'curl'],
    delay: 2000,
    timeout: 45000,
    headers: {
      'Accept': 'text/html,application/xhtml+xml',
    },
  },
  'x.com': {
    priority: 'playwright',
    methods: ['playwright', 'curl'],
    delay: 2000,
    timeout: 45000,
  },
  
  // 新闻网站
  'nytimes.com': {
    priority: 'curl',
    methods: ['curl', 'playwright'],
    delay: 1500,
    timeout: 30000,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  'bbc.com': {
    priority: 'curl',
    methods: ['curl', 'playwright'],
    delay: 1000,
    timeout: 25000,
  },
  'reuters.com': {
    priority: 'curl',
    methods: ['curl', 'playwright'],
    delay: 1000,
    timeout: 25000,
  },
  
  // 技术/开发者
  'github.com': {
    priority: 'curl',
    methods: ['curl', 'playwright'],
    delay: 800,
    timeout: 20000,
    headers: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  },
  'stackoverflow.com': {
    priority: 'curl',
    methods: ['curl', 'playwright'],
    delay: 800,
    timeout: 25000,
  },
  'medium.com': {
    priority: 'curl',
    methods: ['curl', 'playwright'],
    delay: 1000,
    timeout: 30000,
  },
  
  // 视频
  'youtube.com': {
    priority: 'playwright',
    methods: ['playwright'],
    delay: 2000,
    timeout: 60000,
  },
  'youtu.be': {
    priority: 'playwright',
    methods: ['playwright'],
    delay: 2000,
    timeout: 60000,
  },
  
  // 中国网站（可能有不同处理）
  'zhihu.com': {
    priority: 'curl',
    methods: ['curl', 'playwright'],
    delay: 1500,
    timeout: 30000,
  },
  'juejin.cn': {
    priority: 'curl',
    methods: ['curl'],
    delay: 500,
    timeout: 20000,
  },
};

// ============ 默认配置 ============
const DEFAULT_CONFIG = {
  priority: 'curl',
  methods: ['curl', 'playwright'],
  delay: 1000,        // 默认请求间隔
  timeout: 30000,    // 默认超时
  rateLimitRetries: 2,
  maxRetries: 3,
  userAgentRotation: true,
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  },
};

// ============ 站点状态追踪（用于自适应） ============
const siteState = new Map();

// 网站状态
function getSiteState(hostname) {
  if (!siteState.has(hostname)) {
    siteState.set(hostname, {
      consecutiveErrors: 0,
      lastError: null,
      lastStatus: null,
      currentDelay: DEFAULT_CONFIG.delay,
      blocked: false,
      methodIndex: 0,
    });
  }
  return siteState.get(hostname);
}

function updateSiteState(hostname, statusCode, error = null) {
  const state = getSiteState(hostname);
  
  if (statusCode >= 200 && statusCode < 300) {
    // 成功：重置错误计数
    state.consecutiveErrors = 0;
    state.blocked = false;
    // 逐渐恢复延迟
    if (state.currentDelay > DEFAULT_CONFIG.delay) {
      state.currentDelay = Math.max(DEFAULT_CONFIG.delay, state.currentDelay * 0.8);
    }
  } else if (statusCode === 429) {
    // 限流：增加延迟
    state.consecutiveErrors++;
    state.currentDelay = Math.min(30000, state.currentDelay * 2);
    state.blocked = true;
    console.log(`[Adaptive] Rate limited on ${hostname}, increasing delay to ${state.currentDelay}ms`);
  } else if (statusCode === 403 || statusCode === 401) {
    // 认证/权限问题
    state.consecutiveErrors++;
    state.blocked = true;
    console.log(`[Adaptive] Access denied (${statusCode}) on ${hostname}`);
  } else if (statusCode >= 500) {
    // 服务器错误
    state.consecutiveErrors++;
    console.log(`[Adaptive] Server error (${statusCode}) on ${hostname}`);
  } else if (error) {
    // 网络错误
    state.consecutiveErrors++;
    state.lastError = error;
    console.log(`[Adaptive] Network error on ${hostname}: ${error}`);
  }
  
  state.lastStatus = statusCode;
  return state;
}

// ============ 智能延迟 ============
const globalDelay = {
  lastRequest: 0,
  minDelay: 500,
};

async function smartDelay(hostname) {
  const siteConfig = getSiteConfig(hostname);
  const state = getSiteState(hostname);
  
  const delay = Math.max(state.currentDelay, siteConfig.delay);
  
  const now = Date.now();
  const timeSinceLastRequest = now - globalDelay.lastRequest;
  
  const waitTime = Math.max(delay, globalDelay.minDelay - timeSinceLastRequest, 0);
  
  if (waitTime > 0) {
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }
  
  globalDelay.lastRequest = Date.now();
}

// ============ 获取网站配置 ============
function getSiteConfig(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    if (SITE_CONFIGS[hostname]) {
      return { ...DEFAULT_CONFIG, ...SITE_CONFIGS[hostname] };
    }
    
    for (const [key, config] of Object.entries(SITE_CONFIGS)) {
      if (hostname.endsWith(key)) {
        return { ...DEFAULT_CONFIG, ...config };
      }
    }
  } catch (e) {}
  
  return { ...DEFAULT_CONFIG };
}

// ============ 构建请求头 ============
function buildHeaders(url, customHeaders = {}) {
  const config = getSiteConfig(url);
  const headers = { ...config.headers };
  
  if (config.userAgentRotation !== false) {
    headers['User-Agent'] = getNextUA();
  } else {
    headers['User-Agent'] = USER_AGENTS[0];
  }
  
  return { ...headers, ...customHeaders };
}

// ============ 响应分析 ============
function analyzeResponse(hostname, response, body) {
  const statusCode = response.statusCode;
  
  let isBlocked = false;
  let blockReason = null;
  
  if (statusCode === 429) {
    isBlocked = true;
    blockReason = 'rate_limit';
  } else if (statusCode === 403) {
    if (body && body.length < 500 && body.includes('blocked')) {
      isBlocked = true;
      blockReason = 'forbidden';
    }
  } else if (statusCode === 503) {
    isBlocked = true;
    blockReason = 'service_unavailable';
  }
  
  if (!isBlocked && body) {
    const bodyLower = body.toLowerCase();
    if (bodyLower.includes('captcha') || 
        bodyLower.includes('blocked') || 
        bodyLower.includes('access denied') ||
        bodyLower.includes('forbidden') ||
        bodyLower.includes('请验证') ||
        bodyLower.includes('验证码')) {
      isBlocked = true;
      blockReason = 'content_blocked';
    }
  }
  
  if (isBlocked) {
    updateSiteState(hostname, statusCode, blockReason);
  } else {
    updateSiteState(hostname, statusCode);
  }
  
  return { isBlocked, blockReason, statusCode };
}

// ============ 自适应 HTTP 请求 ============
function adaptiveFetch(url, options = {}) {
  return new Promise(async (resolve, reject) => {
    const config = getSiteConfig(url);
    const timeout = options.timeout || config.timeout;
    const method = options.method || 'GET';
    const headers = buildHeaders(url, options.headers);
    
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    const isHttps = urlObj.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    await smartDelay(hostname);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method,
      headers,
      timeout,
      agent: new (isHttps ? https : http).Agent({
        keepAlive: true,
        maxSockets: 6,
      }),
    };
    
    const proxyUrl = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
    if (proxyUrl) {
      const proxy = new URL(proxyUrl);
      requestOptions.hostname = proxy.hostname;
      requestOptions.port = proxy.port;
      requestOptions.path = url;
      requestOptions.headers['Host'] = urlObj.hostname;
    }
    
    const req = lib.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const analysis = analyzeResponse(hostname, res, data);
        
        resolve({
          success: res.statusCode >= 200 && res.statusCode < 300 && !analysis.isBlocked,
          statusCode: res.statusCode,
          headers: res.headers,
          data,
          isBlocked: analysis.isBlocked,
          blockReason: analysis.blockReason,
          url,
        });
      });
    });
    
    req.on('error', (error) => {
      updateSiteState(hostname, 0, error.message);
      reject(error);
    });
    
    req.on('timeout', () => {
      req.destroy();
      updateSiteState(hostname, 0, 'timeout');
      reject(new Error('Request timeout'));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// ============ 自适应重试机制 ============
async function fetchWithRetry(url, options = {}) {
  const config = getSiteConfig(url);
  const maxRetries = options.maxRetries || config.maxRetries;
  const rateLimitRetries = options.rateLimitRetries || config.rateLimitRetries;
  
  let lastError = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await adaptiveFetch(url, options);
      
      if (result.success) {
        return result;
      }
      
      if (result.statusCode === 429 && attempt < rateLimitRetries) {
        const state = getSiteState(new URL(url).hostname);
        const waitTime = state.currentDelay;
        console.log(`[Retry] Rate limited, waiting ${waitTime}ms before retry ${attempt + 1}/${rateLimitRetries}`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (!result.success && attempt < maxRetries - 1) {
        const state = getSiteState(new URL(url).hostname);
        state.methodIndex = (state.methodIndex + 1) % config.methods.length;
        console.log(`[Retry] Trying method ${config.methods[state.methodIndex]}, attempt ${attempt + 1}`);
        continue;
      }
      
      return result;
      
    } catch (error) {
      lastError = error;
      console.log(`[Retry] Attempt ${attempt + 1} failed: ${error.message}`);
      
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 1000;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  return {
    success: false,
    error: lastError?.message || 'Max retries exceeded',
    url,
  };
}

// ============ 获取站点状态 ============
function getSiteStatus(hostname) {
  return getSiteState(hostname);
}

// ============ 重置站点状态 ============
function resetSiteState(hostname) {
  if (hostname) {
    siteState.delete(hostname);
  } else {
    siteState.clear();
  }
}

// ============ 模块导出 ============
module.exports = {
  DEFAULT_CONFIG,
  SITE_CONFIGS,
  USER_AGENTS,
  getSiteConfig,
  getSiteState,
  updateSiteState,
  resetSiteState,
  getSiteStatus,
  adaptiveFetch,
  fetchWithRetry,
  buildHeaders,
  smartDelay,
  analyzeResponse,
  getRandomUA,
  getNextUA,
};
