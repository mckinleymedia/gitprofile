const ConfigManager = require('./config');
const SSHKeyManager = require('./ssh');
const { initCommand } = require('./commands/init');
const { addCommand } = require('./commands/add');
const { switchCommand } = require('./commands/switch');
const { listCommand } = require('./commands/list');
const { currentCommand } = require('./commands/current');
const { removeCommand } = require('./commands/remove');
const { editCommand } = require('./commands/edit');
const { backupCommand } = require('./commands/backup');
const { restoreCommand } = require('./commands/restore');
const { sshManageCommand } = require('./commands/ssh-manage');
const { configCommand } = require('./commands/config');
const { interactiveMenu } = require('./commands/interactive');

class GitSwitch {
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
    return editCommand(this.config, this.ssh, profileName);
  }

  async backup(backupPath) {
    return backupCommand(this.config, backupPath);
  }

  async restore(backupPath, options = {}) {
    return restoreCommand(this.config, backupPath, options);
  }

  async manageSSH(action, profileName) {
    return sshManageCommand(this.config, this.ssh, action, profileName);
  }

  async showConfig() {
    return configCommand(this.config);
  }

  async interactiveMenu() {
    return interactiveMenu(this);
  }
}

module.exports = GitSwitch;