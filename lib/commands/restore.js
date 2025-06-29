const fs = require('fs');
const inquirer = require('inquirer');
const { display, prompts } = require('../utils');

async function restoreCommand(config, backupPath, options = {}) {
  if (!fs.existsSync(backupPath)) {
    display.error(`Backup file not found: ${backupPath}`);
    return;
  }

  if (config.hasProfiles() && !options.force) {
    const { confirm } = await inquirer.prompt([
      prompts.confirmDestructive('This will replace your current configuration. Continue?')
    ]);
    
    if (!confirm) {
      display.info('Restore cancelled');
      return;
    }
  }

  try {
    config.restore(backupPath);
    display.success('Configuration restored successfully');
  } catch (error) {
    display.error(`Restore failed: ${error.message}`);
  }
}

module.exports = { restoreCommand };