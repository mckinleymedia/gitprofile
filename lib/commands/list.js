const chalk = require('chalk');
const { display } = require('../utils');

async function listCommand(config, ssh, options = {}) {
  if (!config.hasProfiles()) {
    display.error('No profiles configured');
    return;
  }

  const profiles = config.getProfilesDetails();
  const currentProfile = config.getCurrentProfile();

  if (options.json) {
    console.log(JSON.stringify(profiles, null, 2));
    return;
  }

  display.header('Configured Profiles');

  if (options.verbose) {
    Object.entries(profiles).forEach(([name, info]) => {
      display.separator();
      display.subheader(`Profile: ${name}${name === currentProfile ? ' ' + chalk.green('(current)') : ''}`);
      display.listItem('Name', info.name);
      display.listItem('Email', info.email);
      display.listItem('Type', info.type || 'Unknown');
      display.listItem('SSH Key', info.sshKey || 'Not configured');
      
      if (info.sshKey) {
        const validation = ssh.validateKeyPair(info.sshKey);
        if (!validation.valid) {
          display.listItem('SSH Key Issue', validation.error, 'error');
        }
      }
      
      if (info.createdAt) {
        display.listItem('Created', new Date(info.createdAt).toLocaleDateString());
      }
      if (info.lastUsed) {
        display.listItem('Last Used', new Date(info.lastUsed).toLocaleDateString());
      }
    });
  } else {
    const tableData = Object.entries(profiles).map(([name, info]) => [
      name + (name === currentProfile ? ' *' : ''),
      info.name,
      info.email,
      info.type || 'Unknown'
    ]);
    
    display.table(tableData, ['Profile', 'Name', 'Email', 'Type']);
    
    if (currentProfile) {
      console.log(chalk.gray('\n* Currently active'));
    }
  }
}

module.exports = { listCommand };