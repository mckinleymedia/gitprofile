const inquirer = require('inquirer');
const { display, prompts } = require('../utils');

async function removeCommand(config, ssh, profileName, options = {}) {
  const profile = config.getProfile(profileName);
  if (!profile) {
    display.error(`Profile '${profileName}' not found`);
    return;
  }

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      prompts.confirmDestructive(`Remove profile '${profileName}'?`)
    ]);
    
    if (!confirm) {
      display.info('Removal cancelled');
      return;
    }
  }

  // Remove from SSH config
  if (profile.sshKey) {
    ssh.removeFromSSHConfig(profileName);
  }

  // Remove profile
  config.deleteProfile(profileName);
  display.success(`Profile '${profileName}' removed`);
}

module.exports = { removeCommand };