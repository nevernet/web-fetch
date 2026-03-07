const chalk = require('chalk');
const fetcher = require('../lib/fetcher');

async function run(opts) {
  console.log(chalk.cyan('正在采集新闻...'));
  
  try {
    const results = await fetcher.fetchAll();
    console.log(chalk.green(`✓ 采集完成! 共 ${results.length} 篇`));
    
    if (opts.format === 'text') {
      console.log(fetcher.toTextSummary(results));
    } else if (opts.format === 'list') {
      results.forEach(r => console.log(`• ${r.title} (${r.source})`));
    } else {
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (e) {
    console.log(chalk.red(`✗ 采集失败: ${e.message}`));
    process.exit(1);
  }
}

module.exports = run;
