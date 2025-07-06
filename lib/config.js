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
        
        // Ensure profiles exist
        if (!config.profiles) {
          config.profiles = {};
        }
        
        return config;
      }
    } catch (error) {
      console.error('Error loading configuration:', error.message);
    }
    return { profiles: {} };
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
    this.config = { profiles: {} };
    return this.save();
  }

  addProfile(name, profileData) {
    if (!name || !profileData) {
      throw new Error('Profile name and data are required');
    }
    
    if (this.config.profiles[name]) {
      throw new Error(`Profile '${name}' already exists`);
    }

    this.config.profiles[name] = {
      name: profileData.name || '',
      email: profileData.email || '',
      sshKey: profileData.sshKey || '',
      type: profileData.type || 'GitHub',
      createdAt: new Date().toISOString(),
      lastUsed: null
    };

    return this.save();
  }

  updateProfile(name, profileData) {
    if (!this.config.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    this.config.profiles[name] = {
      ...this.config.profiles[name],
      ...profileData,
      updatedAt: new Date().toISOString()
    };

    return this.save();
  }

  deleteProfile(name) {
    if (!this.config.profiles[name]) {
      throw new Error(`Profile '${name}' does not exist`);
    }

    delete this.config.profiles[name];
    return this.save();
  }

  renameProfile(oldName, newName) {
    if (!this.config.profiles[oldName]) {
      throw new Error(`Profile '${oldName}' does not exist`);
    }

    if (this.config.profiles[newName]) {
      throw new Error(`Profile '${newName}' already exists`);
    }

    this.config.profiles[newName] = this.config.profiles[oldName];
    delete this.config.profiles[oldName];
    return this.save();
  }

  getProfile(name) {
    return this.config.profiles[name] || null;
  }

  getAllProfiles() {
    return Object.keys(this.config.profiles);
  }

  getProfilesDetails() {
    return this.config.profiles;
  }

  hasProfiles() {
    return Object.keys(this.config.profiles).length > 0;
  }

  updateLastUsed(name) {
    if (this.config.profiles[name]) {
      this.config.profiles[name].lastUsed = new Date().toISOString();
      this.save();
    }
  }

  getCurrentProfile() {
    const { execSync } = require('child_process');
    
    try {
      const currentUser = execSync('git config --global user.name', { stdio: 'pipe' })
        .toString()
        .trim();
      const currentEmail = execSync('git config --global user.email', { stdio: 'pipe' })
        .toString()
        .trim();

      for (const [name, info] of Object.entries(this.config.profiles)) {
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