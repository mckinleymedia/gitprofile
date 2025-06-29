const fs = require('fs');
const { display } = require('../utils');

async function configCommand(config) {
  display.header('GitProfile Configuration');
  display.listItem('Config Path', config.configPath);
  display.listItem('Profiles', Object.keys(config.getProfilesDetails()).length);
  display.listItem('Current Profile', config.getCurrentProfile() || 'None');
  
  if (fs.existsSync(config.configPath)) {
    const configSize = fs.statSync(config.configPath).size;
    display.listItem('Config Size', `${configSize} bytes`);
  }
}

module.exports = { configCommand };