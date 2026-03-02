/**
 * Cache Module - 本地缓存机制
 * 支持 scrape、extract、search 结果缓存
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_DIR = process.env.CACHE_DIR || path.join(__dirname, '..', '.cache');
const DEFAULT_TTL = parseInt(process.env.CACHE_TTL || '3600'); // 默认1小时

// 确保缓存目录存在
function initCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

initCache();

// 生成缓存键
function getCacheKey(type, params) {
  const str = JSON.stringify(params);
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${type}_${hash}`;
}

// 获取缓存文件路径
function getCachePath(key) {
  return path.join(CACHE_DIR, key + '.json');
}

// 读取缓存
function get(key) {
  try {
    const filePath = getCachePath(key);
    if (!fs.existsSync(filePath)) return null;
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // 检查是否过期
    if (data.expires && Date.now() > data.expires) {
      fs.unlinkSync(filePath);
      return null;
    }
    
    return data.value;
  } catch (e) {
    return null;
  }
}

// 写入缓存
function set(key, value, ttl) {
  ttl = ttl || DEFAULT_TTL;
  try {
    const filePath = getCachePath(key);
    const data = {
      value: value,
      created: Date.now(),
      expires: Date.now() + (ttl * 1000)
    };
    fs.writeFileSync(filePath, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error('Cache write error:', e.message);
    return false;
  }
}

// 清除缓存
function clear(key) {
  try {
    const filePath = getCachePath(key);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (e) {
    return false;
  }
}

// 清除所有缓存
function clearAll() {
  try {
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    }
    return true;
  } catch (e) {
    return false;
  }
}

// 获取缓存状态
function status() {
  try {
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    let totalSize = 0;
    let expired = 0;
    let valid = 0;
    
    for (const file of files) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      totalSize += stats.size;
      
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (data.expires && Date.now() > data.expires) {
          expired++;
        } else {
          valid++;
        }
      } catch (e) {
        expired++;
      }
    }
    
    return {
      total: files.length,
      valid: valid,
      expired: expired,
      sizeBytes: totalSize,
      sizeMB: (totalSize / 1024 / 1024).toFixed(2),
      cacheDir: CACHE_DIR
    };
  } catch (e) {
    return { error: e.message };
  }
}

// 缓存装饰器 - 自动缓存函数结果
function cached(fn, options = {}) {
  const { ttl = DEFAULT_TTL, keyGenerator = null } = options;
  
  return async function(...args) {
    // 生成缓存键
    const cacheKey = keyGenerator 
      ? keyGenerator(...args)
      : getCacheKey(fn.name || 'default', args);
    
    // 尝试从缓存获取
    const cachedValue = get(cacheKey);
    if (cachedValue !== null) {
      return { 
        fromCache: true, 
        data: cachedValue,
        cacheKey 
      };
    }
    
    // 执行原函数
    const result = await fn.apply(this, args);
    
    // 缓存结果 (只缓存成功的请求)
    if (result && result.success) {
      set(cacheKey, result, ttl);
    }
    
    return { 
      fromCache: false, 
      data: result,
      cacheKey 
    };
  };
}

module.exports = {
  get,
  set,
  clear,
  clearAll,
  status,
  cached,
  getCacheKey,
  DEFAULT_TTL,
  CACHE_DIR
};
