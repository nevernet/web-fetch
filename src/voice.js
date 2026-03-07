/**
 * News Voice Generator - 语音生成脚本
 * 
 * 功能：将新闻文本转换为语音稿
 * 运行：node src/voice.js [input]
 *   - node src/fetcher.js | node src/voice.js
 *   - cat news.json | node src/voice.js
 */

const readline = require('readline');

function generateVoice(text) {
  let result = '各位听众朋友们大家好，今天的新闻摘要来了。';
  const lines = text.split('\n').filter(l => l.startsWith('•'));
  
  for (const line of lines.slice(0, 8)) {
    let t = line.replace('• ', '').replace(/原文:.*/, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').substring(0, 40);
    if (t) result += t + '。';
  }
  return result + '以上就是今天的新闻摘要，谢谢收听。';
}

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on('line', (line) => { data += line + '\n'; });
    rl.on('close', () => resolve(data));
  });
}

async function main() {
  const args = process.argv.slice(2);
  let text = '';
  
  if (args.length > 0) {
    text = args.join(' ');
  } else if (!process.stdin.isTTY) {
    text = await readStdin();
  } else {
    console.error('用法: node src/voice.js "文本" 或 cat news.json | node src/voice.js');
    process.exit(1);
  }
  
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json)) text = json.map(item => '• ' + item.title).join('\n');
  } catch (e) {}
  
  console.log(generateVoice(text));
}

main().catch(console.error);
