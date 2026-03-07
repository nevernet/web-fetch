const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'logs', 'fetcher.log');

function run(opts) {
  if (!fs.existsSync(LOG_FILE)) {
    console.log(chalk.yellow('暂无日志'));
    return;
  }
  
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = content.split('\n').filter(l => l);
  
  let filtered = lines;
  if (opts.level) {
    const level = opts.level.toUpperCase();
    filtered = lines.filter(l => l.includes(`[${level}]`));
  }
  
  filtered.slice(-50).forEach(line => {
    if (line.includes('[ERROR]')) console.log(chalk.red(line));
    else if (line.includes('[WARN]')) console.log(chalk.yellow(line));
    else if (line.includes('[DEBUG]')) console.log(chalk.gray(line));
    else console.log(line);
  });
}

module.exports = run;
