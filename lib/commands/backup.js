const fs = require('fs');
const { display } = require('../utils');

async function backupCommand(config, backupPath) {
  try {
    const path = config.backup();
    const finalPath = backupPath || path;
    
    if (backupPath && backupPath !== path) {
      fs.copyFileSync(path, backupPath);
    }
    
    display.success(`Configuration backed up to: ${finalPath}`);
  } catch (error) {
    display.error(`Backup failed: ${error.message}`);
  }
}

module.exports = { backupCommand };