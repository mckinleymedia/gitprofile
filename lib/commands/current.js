const { gitUtils, display } = require('../utils');

async function currentCommand(config) {
  const current = config.getCurrentProfile();
  const gitConfig = gitUtils.getCurrentGitConfig();

  if (current) {
    const profile = config.getProfile(current);
    display.header(`Current Profile: ${current}`);
    display.listItem('Name', gitConfig.name);
    display.listItem('Email', gitConfig.email);
    display.listItem('Type', profile.type);
    
    if (profile.sshKey) {
      display.listItem('SSH Key', profile.sshKey);
    }
  } else {
    display.warning('No matching GitProfile for current Git configuration');
    if (gitConfig.name || gitConfig.email) {
      display.listItem('Git Name', gitConfig.name || 'Not set');
      display.listItem('Git Email', gitConfig.email || 'Not set');
    }
  }
}

module.exports = { currentCommand };