const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(process.cwd(), 'logs');

function clean(target) {
  const targets = {
    cache: ['.cache'],
    logs: ['fetcher.log'],
    stats: ['stats.json'],
    all: ['fetcher.log', 'stats.json', 'alert.json']
  };
  
  const files = targets[target];
  if (!files) {
    console.log(chalk.red(`未知目标: ${target}`));
    console.log(chalk.cyan('可用: cache|logs|stats|all'));
    return;
  }
  
  files.forEach(f => {
    const p = path.join(LOGS_DIR, f);
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
      console.log(chalk.yellow(`删除: ${f}`));
    }
  });
  
  console.log(chalk.green('✓ 清理完成'));
}

module.exports = clean;
