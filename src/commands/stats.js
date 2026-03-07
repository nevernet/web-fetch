const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const STATS_FILE = path.join(process.cwd(), 'logs', 'stats.json');

function run(opts) {
  let stats = { totalRuns: 0, totalArticles: 0, totalErrors: 0, totalTimeMs: 0, bySource: {} };
  
  try {
    if (fs.existsSync(STATS_FILE)) {
      stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf-8'));
    }
  } catch (e) {}
  
  const avgTime = stats.totalRuns > 0 ? (stats.totalTimeMs / stats.totalRuns / 1000).toFixed(1) : 0;
  const avgArticles = stats.totalRuns > 0 ? (stats.totalArticles / stats.totalRuns).toFixed(1) : 0;
  const successRate = stats.totalRuns > 0 ? ((1 - stats.totalErrors / stats.totalRuns) * 100).toFixed(1) : 100;
  
  console.log(chalk.bold('\n📊 监控面板 =====\n'));
  console.log(`  ${chalk.cyan('总运行次数:')} ${stats.totalRuns}`);
  console.log(`  ${chalk.cyan('总采集文章:')} ${stats.totalArticles}`);
  console.log(`  ${chalk.cyan('总错误数:')} ${stats.totalErrors}`);
  console.log(`  ${chalk.cyan('平均耗时:')} ${avgTime}s`);
  console.log(`  ${chalk.cyan('平均文章数:')} ${avgArticles}`);
  console.log(`  ${chalk.cyan('成功率:')} ${successRate}%`);
  console.log(chalk.bold('\n📈 各来源统计:\n'));
  
  for (const [source, data] of Object.entries(stats.bySource)) {
    console.log(`  ${source}: ${data.articles} 篇, ${data.errors} 错误`);
  }
  console.log('\n=======================\n');
}

module.exports = run;
