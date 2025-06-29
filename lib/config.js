const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.configPath = path.join(
      process.env.HOME || process.env.USERPROFILE,
      '.gitswitch.json'
    );
    this.config = this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        const config = JSON.parse(data);
        
        // Migration: Remove publicKey field from existing configs
        let needsSave = false;
        if (config.accounts) {
          Object.keys(config.accounts).forEach(accountName => {
            if (config.accounts[accountName].publicKey !== undefined) {
              delete config.accounts[accountName].publicKey;
              needsSave = true;
            }
          });
        }
        
        if (needsSave) {
          this.config = config;
          this.save();
        }
        
        return config;
      }
    } catch (error) {
      console.error('Error loading configuration:', error.message);
    }
    return { accounts: {} };
  }

  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving configuration:', error.message);
      return false;
    }
  }

  reset() {
    this.config = { accounts: {} };
    return this.save();
  }

  addAccount(name, accountData) {
    if (!name || !accountData) {
      throw new Error('Account name and data are required');
    }
    
    if (this.config.accounts[name]) {
      throw new Error(`Account '${name}' already exists`);
    }

    this.config.accounts[name] = {
      name: accountData.name || '',
      email: accountData.email || '',
      sshKey: accountData.sshKey || '',
      type: accountData.type || 'GitHub',
      createdAt: new Date().toISOString(),
      lastUsed: null
    };

    return this.save();
  }

  updateAccount(name, accountData) {
    if (!this.config.accounts[name]) {
      throw new Error(`Account '${name}' does not exist`);
    }

    this.config.accounts[name] = {
      ...this.config.accounts[name],
      ...accountData,
      updatedAt: new Date().toISOString()
    };

    return this.save();
  }

  deleteAccount(name) {
    if (!this.config.accounts[name]) {
      throw new Error(`Account '${name}' does not exist`);
    }

    delete this.config.accounts[name];
    return this.save();
  }

  renameAccount(oldName, newName) {
    if (!this.config.accounts[oldName]) {
      throw new Error(`Account '${oldName}' does not exist`);
    }

    if (this.config.accounts[newName]) {
      throw new Error(`Account '${newName}' already exists`);
    }

    this.config.accounts[newName] = this.config.accounts[oldName];
    delete this.config.accounts[oldName];
    return this.save();
  }

  getAccount(name) {
    return this.config.accounts[name] || null;
  }

  getAllAccounts() {
    return Object.keys(this.config.accounts);
  }

  getAccountsDetails() {
    return this.config.accounts;
  }

  hasAccounts() {
    return Object.keys(this.config.accounts).length > 0;
  }

  updateLastUsed(name) {
    if (this.config.accounts[name]) {
      this.config.accounts[name].lastUsed = new Date().toISOString();
      this.save();
    }
  }

  getCurrentAccount() {
    const { execSync } = require('child_process');
    
    try {
      const currentUser = execSync('git config --global user.name', { stdio: 'pipe' })
        .toString()
        .trim();
      const currentEmail = execSync('git config --global user.email', { stdio: 'pipe' })
        .toString()
        .trim();

      for (const [name, info] of Object.entries(this.config.accounts)) {
        if (info.name === currentUser && info.email === currentEmail) {
          return name;
        }
      }
    } catch (error) {
      // Git config not found
    }
    
    return null;
  }

  backup() {
    const backupPath = `${this.configPath}.backup`;
    try {
      fs.copyFileSync(this.configPath, backupPath);
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
    }
  }

  restore(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error('Backup file does not exist');
      }
      
      fs.copyFileSync(backupPath, this.configPath);
      this.config = this.load();
      return true;
    } catch (error) {
      throw new Error(`Failed to restore backup: ${error.message}`);
    }
  }
}

module.exports = ConfigManager;