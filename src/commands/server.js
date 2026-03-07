const { spawn } = require('child_process');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const PM2_NAME = 'web-fetch-web';
const WEB_PORT = process.env.WEB_PORT || 8081;

function start() {
  console.log(chalk.cyan(`🌐 启动 Web 面板...`));
  console.log(chalk.cyan(`📍 访问地址: http://localhost:${WEB_PORT}`));
  
  const web = require('../web/app');
  web.start(WEB_PORT);
}

function stop() {
  console.log(chalk.yellow('停止 Web 服务...'));
  require('child_process').execSync(`pm2 stop ${PM2_NAME}`, { stdio: 'inherit' });
  console.log(chalk.green('✓ 已停止'));
}

function status() {
  try {
    const output = require('child_process').execSync(`pm2 list | grep ${PM2_NAME}`, { encoding: 'utf-8' });
    console.log(output);
  } catch (e) {
    console.log(chalk.yellow('Web 服务未运行'));
  }
}

function action(act) {
  if (act === 'start') start();
  else if (act === 'stop') stop();
  else if (act === 'status') status();
  else console.log(chalk.red('未知操作: ' + act));
}

module.exports = action;
