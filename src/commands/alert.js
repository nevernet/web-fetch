const chalk = require('chalk');
const fs = require('fs');
const path = require('path');

const ALERT_FILE = path.join(process.cwd(), 'logs', 'alert.json');

function loadConfig() {
  try {
    if (fs.existsSync(ALERT_FILE)) {
      return JSON.parse(fs.readFileSync(ALERT_FILE, 'utf-8'));
    }
  } catch (e) {}
  return { enabled: false, rules: { errorThreshold: 3, successRateThreshold: 50, noDataThreshold: true }};
}

function saveConfig(config) {
  fs.writeFileSync(ALERT_FILE, JSON.stringify(config, null, 2));
}

function run(opts) {
  const config = loadConfig();
  
  if (opts.enable) {
    config.enabled = true;
    saveConfig(config);
    console.log(chalk.green('✓ 告警已启用'));
  } else if (opts.disable) {
    config.enabled = false;
    saveConfig(config);
    console.log(chalk.yellow('• 告警已禁用'));
  } else {
    console.log(chalk.bold('\n⚠️ 告警配置 =====\n'));
    console.log(`  ${chalk.cyan('状态:')} ${config.enabled ? chalk.green('启用') : chalk.gray('禁用')}`);
    console.log(`  ${chalk.cyan('错误阈值:')} ${config.rules.errorThreshold}`);
    console.log(`  ${chalk.cyan('成功率阈值:')} ${config.rules.successRateThreshold}%`);
    console.log(`  ${chalk.cyan('无数据告警:')} ${config.rules.noDataThreshold ? '是' : '否'}`);
    console.log('\n=======================\n');
  }
}

module.exports = run;
