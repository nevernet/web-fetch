#!/usr/bin/env node

const { program } = require('commander');
const chalk = require('chalk');

const FETCH_URL = process.env.FETCH_URL || 'http://localhost:8080';
const WEB_PORT = process.env.WEB_PORT || 8081;

// 命令列表
const commands = {
  fetch: require('./commands/fetch'),
  stats: require('./commands/stats'),
  alert: require('./commands/alert'),
  log: require('./commands/log'),
  server: require('./commands/server'),
  clean: require('./commands/clean'),
  help: () => {
    console.log(`
${chalk.bold('Web-Fetch CLI')}

${chalk.cyan('使用:')} node src/index.js <command> [options]

${chalk.cyan('命令:')}
  ${chalk.green('fetch')}           采集新闻
  ${chalk.green('stats')}           查看统计
  ${chalk.green('alert')}            告警配置
  ${chalk.green('log')}              查看日志
  ${chalk.green('server')}           服务管理
  ${chalk.green('clean')}            清理数据

${chalk.cyan('选项:')}
  -h, --help           显示帮助
  -v, --version        显示版本

${chalk.cyan('示例:')}
  node src/index.js fetch
  node src/index.js fetch --format text
  node src/index.js stats
  node src/index.js server start
`);
  }
};

// 注册命令
program
  .name('web-fetch')
  .description('Web-Fetch CLI + Web 监控面板')
  .version('2.0.0');

// fetch 命令
program
  .command('fetch')
  .description('采集新闻')
  .option('-f, --format <type>', '输出格式 (json|text|list)', 'json')
  .action((opts) => commands.fetch(opts));

// stats 命令
program
  .command('stats')
  .description('查看统计')
  .option('-v, --verbose', '详细输出')
  .action((opts) => commands.stats(opts));

// alert 命令
program
  .command('alert')
  .description('告警配置')
  .option('-e, --enable', '启用告警')
  .option('-d, --disable', '禁用告警')
  .action((opts) => commands.alert(opts));

// log 命令
program
  .command('log')
  .description('查看日志')
  .option('-f, --follow', '实时跟踪')
  .option('-l, --level <level>', '日志级别 (error|warn|info|debug)')
  .action((opts) => commands.log(opts));

// server 命令
program
  .command('server')
  .description('服务管理')
  .argument('<action>', 'start|stop|restart|status')
  .action((action) => commands.server(action));

// clean 命令
program
  .command('clean')
  .description('清理数据')
  .argument('<target>', 'cache|logs|stats|all')
  .action((target) => commands.clean(target));

// 默认显示帮助
program.on('command:*', () => {
  commands.help();
  process.exit(1);
});

program.parse();
