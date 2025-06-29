const ConfigManager = require('./config');
const SSHKeyManager = require('./ssh');
const { initCommand } = require('./commands/init');
const { addCommand } = require('./commands/add');
const { switchCommand } = require('./commands/switch');
const { listCommand } = require('./commands/list');
const { currentCommand } = require('./commands/current');
const { removeCommand } = require('./commands/remove');

class GitProfile {
  constructor() {
    this.config = new ConfigManager();
    this.ssh = new SSHKeyManager();
  }

  async init(options = {}) {
    return initCommand(this.config, options);
  }

  async addProfile(profileName = null, options = {}) {
    return addCommand(this.config, this.ssh, profileName, options);
  }

  async switchProfile(profileName = null, options = {}) {
    return switchCommand(this.config, this.ssh, profileName, options);
  }

  async listProfiles(options = {}) {
    return listCommand(this.config, this.ssh, options);
  }

  async showCurrent() {
    return currentCommand(this.config);
  }

  async removeProfile(profileName, options = {}) {
    return removeCommand(this.config, this.ssh, profileName, options);
  }

  async editProfile(profileName) {
    // TODO: Implement edit command
    const { display } = require('./utils');
    display.error('Edit command not yet implemented in modular version');
  }

  async backup(backupPath) {
    // TODO: Implement backup command
    const { display } = require('./utils');
    display.error('Backup command not yet implemented in modular version');
  }

  async restore(backupPath, options = {}) {
    // TODO: Implement restore command
    const { display } = require('./utils');
    display.error('Restore command not yet implemented in modular version');
  }

  async manageSSH(action, profileName) {
    // TODO: Implement SSH management command
    const { display } = require('./utils');
    display.error('SSH management command not yet implemented in modular version');
  }

  async showConfig() {
    // TODO: Implement config command
    const { display } = require('./utils');
    display.error('Config command not yet implemented in modular version');
  }

  async interactiveMenu() {
    // TODO: Implement interactive menu
    const { display } = require('./utils');
    display.warning('Interactive menu coming soon!');
    display.info('Use "gitprofile --help" to see available commands');
  }
}

module.exports = GitProfile;