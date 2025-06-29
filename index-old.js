#!/usr/bin/env node

const inquirer = require('inquirer');
const chalk = require('chalk');
const ConfigManager = require('./lib/config');
const SSHKeyManager = require('./lib/ssh');
const { validators, gitUtils, display, errorHandler, prompts } = require('./lib/utils');
const { parseArguments } = require('./lib/cli');

class GitSwitch {
  constructor() {
    this.config = new ConfigManager();
    this.ssh = new SSHKeyManager();
  }

  async init(options = {}) {
    display.header('Initializing GitSwitch');

    if (this.config.hasProfiles() && !options.force) {
      const { proceed } = await inquirer.prompt([
        prompts.confirmDestructive('Configuration already exists. Do you want to reinitialize?')
      ]);
      
      if (!proceed) {
        display.info('Initialization cancelled');
        return;
      }
    }

    // Reset config
    this.config.reset();
    
    // Get current git config
    const currentConfig = gitUtils.getCurrentGitConfig();
    
    if (!currentConfig.name && !currentConfig.email) {
      display.warning('No existing Git configuration found');
    } else {
      display.info(`Current Git user: ${currentConfig.name} <${currentConfig.email}>`);
    }

    // Ask for profile details
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'profileName',
        message: 'Enter a name for the current profile:',
        default: currentConfig.email || 'default',
        validate: (input) => {
          try {
            validators.profileName(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'list',
        name: 'profileType',
        message: 'Select the profile type:',
        loop: false,
        choices: ['GitHub', 'GitLab', 'Bitbucket'],
        default: 'GitHub'
      }
    ]);

    // Save current profile
    this.config.addProfile(answers.profileName, {
      name: currentConfig.name,
      email: currentConfig.email,
      type: answers.profileType
    });

    display.success(`Profile '${answers.profileName}' saved`);

    // Ask if user wants to add another profile
    const { addAnother } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addAnother',
        message: 'Do you want to add another profile?',
        default: false
      }
    ]);

    if (addAnother) {
      await this.addProfile();
    }

    display.success('GitSwitch initialization complete');
  }

  async addProfile(profileName = null, options = {}) {
    display.header('Add New Profile');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'profileName',
        message: 'Enter a name for this profile:',
        default: profileName,
        when: !profileName,
        validate: (input) => {
          try {
            validators.profileName(input);
            if (this.config.getProfile(input)) {
              return `Profile '${input}' already exists`;
            }
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'list',
        name: 'profileType',
        message: 'Select the profile type:',
        loop: false,
        choices: ['GitHub', 'GitLab', 'Bitbucket'],
        default: options.type || 'GitHub',
        when: !options.type
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter the Git user name for this profile:',
        default: options.name,
        when: !options.name,
        validate: (input) => {
          try {
            validators.gitUserName(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'email',
        message: 'Enter the Git email for this profile:',
        default: options.email,
        when: !options.email,
        validate: (input) => {
          try {
            validators.email(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'confirm',
        name: 'generateSshKey',
        message: 'Do you want to generate a new SSH key for this profile?',
        default: options.generateSsh || false,
        when: !options.sshKey && options.generateSsh === undefined
      }
    ]);

    // Merge CLI options with interactive answers
    const finalAnswers = {
      profileName: profileName || answers.profileName,
      profileType: options.type || answers.profileType,
      name: options.name || answers.name,
      email: options.email || answers.email,
      generateSshKey: options.generateSsh || answers.generateSshKey,
      sshKey: options.sshKey
    };

    // Handle SSH key
    let sshKeyPath = '';
    let publicKey = '';

    if (finalAnswers.generateSshKey) {
      sshKeyPath = this.ssh.generateKeyPath(finalAnswers.profileName);
      
      if (this.ssh.keyExists(sshKeyPath)) {
        const { regenerate } = await inquirer.prompt([
          prompts.confirmDestructive(`SSH key already exists at ${sshKeyPath}. Regenerate?`)
        ]);
        
        if (regenerate) {
          const { confirm } = await inquirer.prompt([
            prompts.confirmTyped('This will overwrite the existing key', 'yes')
          ]);
          
          if (confirm === 'yes') {
            await this.ssh.generateKey(finalAnswers.email, sshKeyPath);
            display.success('SSH key regenerated');
          } else {
            display.info('Keeping existing SSH key');
          }
        }
      } else {
        await this.ssh.generateKey(finalAnswers.email, sshKeyPath);
        display.success('SSH key generated');
      }

      publicKey = this.ssh.getPublicKey(sshKeyPath);
      
      const { copyToClipboard } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'copyToClipboard',
          message: 'Copy public key to clipboard?',
          default: true
        }
      ]);

      if (copyToClipboard) {
        await this.ssh.copyToClipboard(publicKey);
        display.success('Public key copied to clipboard');
      }

      const setupUrl = this.ssh.getGitServiceUrl(finalAnswers.profileType);
      display.info(`Add your SSH key at: ${chalk.underline(setupUrl)}`);
      
      // Update SSH config
      if (!options.quiet) {
        const { updateConfig } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'updateConfig',
            message: 'Add this profile to SSH config for easier Git operations?',
            default: true
          }
        ]);

        if (updateConfig) {
          const hostAlias = await this.ssh.updateSSHConfig(
            finalAnswers.profileName,
            sshKeyPath,
            finalAnswers.profileType
          );
          display.success(`SSH config updated. Use '${hostAlias}' as the host in Git URLs`);
          display.info(`Example: git clone git@${hostAlias}:username/repo.git`);
        }
      }
    } else if (finalAnswers.sshKey) {
      sshKeyPath = finalAnswers.sshKey;
      const validation = this.ssh.validateKeyPair(sshKeyPath);
      
      if (!validation.valid) {
        if (validation.fixable) {
          display.warning(validation.error);
          const { fix } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'fix',
              message: 'Fix permissions automatically?',
              default: true
            }
          ]);
          
          if (fix) {
            this.ssh.fixKeyPermissions(sshKeyPath);
            display.success('Permissions fixed');
          }
        } else {
          throw new Error(validation.error);
        }
      }
      
      publicKey = this.ssh.getPublicKey(sshKeyPath);
    }

    // Save profile
    this.config.addProfile(finalAnswers.profileName, {
      name: finalAnswers.name,
      email: finalAnswers.email,
      sshKey: sshKeyPath,
      type: finalAnswers.profileType
    });

    display.success(`Profile '${finalAnswers.profileName}' added successfully`);
    
    // Test SSH connection if configured
    if (sshKeyPath && finalAnswers.profileType) {
      process.stdout.write('\nTesting SSH connection... ');
      
      const gitHost = finalAnswers.profileType === 'GitHub' ? 'github.com' :
                      finalAnswers.profileType === 'GitLab' ? 'gitlab.com' :
                      finalAnswers.profileType === 'Bitbucket' ? 'bitbucket.org' : null;
      
      if (gitHost) {
        try {
          const command = `ssh -T -o StrictHostKeyChecking=no -o PasswordAuthentication=no -i "${sshKeyPath}" git@${gitHost}`;
          let result = '';
          
          try {
            result = require('child_process').execSync(command, { encoding: 'utf8', stdio: 'pipe' });
          } catch (error) {
            result = error.stdout || error.stderr || error.toString();
          }
          
          if (result.includes('successfully authenticated') || 
              result.includes('Welcome to GitLab') || 
              result.includes('logged in as')) {
            console.log(chalk.green('✓'));
            display.listItem('SSH Connection', 'Confirmed', 'success');
          } else if (result.includes('Permission denied')) {
            console.log(chalk.red('✗'));
            display.listItem('SSH Connection', 'Key not yet authorized', 'warning');
            display.info(`Remember to add your key at: ${this.ssh.getGitServiceUrl(finalAnswers.profileType)}`);
          } else {
            console.log(chalk.yellow('?'));
            display.listItem('SSH Connection', 'Unknown status', 'warning');
          }
        } catch (error) {
          console.log(chalk.red('✗'));
          display.listItem('SSH Connection', 'Test failed', 'error');
        }
      }
    }
  }

  async switchProfile(profileName = null, options = {}) {
    if (!this.config.hasProfiles()) {
      display.error('No profiles configured. Run "gitswitch init" first');
      return;
    }

    let selectedProfile = profileName;

    if (!selectedProfile) {
      const profiles = this.config.getAllProfiles();
      const currentProfile = this.config.getCurrentProfile();

      const { profile } = await inquirer.prompt([
        {
          type: 'list',
          name: 'profile',
          message: 'Select a profile to switch to:',
          loop: false,
          choices: profiles.map(acc => ({
            name: acc === currentProfile ? `${acc} ${chalk.green('(current)')}` : acc,
            value: acc
          }))
        }
      ]);
      
      selectedProfile = profile;
    }

    const profileData = this.config.getProfile(selectedProfile);
    if (!profileData) {
      display.error(`Profile '${selectedProfile}' not found`);
      return;
    }

    // Switch Git config
    gitUtils.setGitConfig(profileData.name, profileData.email);
    display.success(`Switched to profile: ${selectedProfile}`);
    display.listItem('Name', profileData.name);
    display.listItem('Email', profileData.email);
    display.listItem('Type', profileData.type);

    // Update last used
    this.config.updateLastUsed(selectedProfile);

    // Test SSH connection if configured
    if (profileData.sshKey && profileData.type) {
      process.stdout.write('Testing SSH connection... ');
      
      const gitHost = profileData.type === 'GitHub' ? 'github.com' :
                      profileData.type === 'GitLab' ? 'gitlab.com' :
                      profileData.type === 'Bitbucket' ? 'bitbucket.org' : null;
      
      if (gitHost) {
        try {
          const command = `ssh -T -o StrictHostKeyChecking=no -o PasswordAuthentication=no -i "${profileData.sshKey}" git@${gitHost}`;
          let result = '';
          
          try {
            result = require('child_process').execSync(command, { encoding: 'utf8', stdio: 'pipe' });
          } catch (error) {
            result = error.stdout || error.stderr || error.toString();
          }
          
          if (result.includes('successfully authenticated') || 
              result.includes('Welcome to GitLab') || 
              result.includes('logged in as')) {
            console.log(chalk.green('✓'));
            display.listItem('SSH Connection', 'Confirmed', 'success');
          } else if (result.includes('Permission denied')) {
            console.log(chalk.red('✗'));
            display.listItem('SSH Connection', 'Not authorized', 'error');
            display.info(`Add your key at: ${this.ssh.getGitServiceUrl(profileData.type)}`);
          } else {
            console.log(chalk.yellow('?'));
            display.listItem('SSH Connection', 'Unknown', 'warning');
          }
        } catch (error) {
          console.log(chalk.red('✗'));
          display.listItem('SSH Connection', 'Failed', 'error');
        }
      }
    }

  }

  async listProfiles(options = {}) {
    if (!this.config.hasProfiles()) {
      display.error('No profiles configured');
      return;
    }

    const profiles = this.config.getProfilesDetails();
    const currentProfile = this.config.getCurrentProfile();

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
          const validation = this.ssh.validateKeyPair(info.sshKey);
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

  async editProfile(profileName) {
    const profile = this.config.getProfile(profileName);
    if (!profile) {
      display.error(`Profile '${profileName}' not found`);
      return;
    }

    display.header(`Edit Profile: ${profileName}`);

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'New profile name (identifier):',
        default: profileName,
        validate: (input) => {
          try {
            validators.profileName(input);
            if (input !== profileName && this.config.getProfile(input)) {
              return `Profile '${input}' already exists`;
            }
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'userName',
        message: 'Git user name:',
        default: profile.name,
        validate: (input) => {
          try {
            validators.gitUserName(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'input',
        name: 'email',
        message: 'Git email:',
        default: profile.email,
        validate: (input) => {
          try {
            validators.email(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'list',
        name: 'type',
        message: 'Profile type:',
        loop: false,
        choices: ['GitHub', 'GitLab', 'Bitbucket'],
        default: profile.type || 'GitHub'
      }
    ]);

    // Ask about SSH key
    let sshKeyPath = profile.sshKey || '';
    const { updateSshKey } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'updateSshKey',
        message: profile.sshKey ? 'Update SSH key?' : 'Add SSH key?',
        default: !profile.sshKey
      }
    ]);

    if (updateSshKey) {
      // List available SSH keys
      const sshKeys = this.ssh.listAvailableKeys();
      if (sshKeys.length > 0) {
        const keyChoices = [
          ...sshKeys.map(key => ({
            name: `${key.name} ${key.hasPublicKey ? '' : '(missing public key)'}`,
            value: key.path
          })),
          new inquirer.Separator(),
          { name: 'Enter path manually', value: 'manual' },
          { name: 'Skip', value: 'skip' }
        ];

        const { selectedKey } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedKey',
            message: 'Select SSH key:',
            loop: false,
            choices: keyChoices,
            default: profile.sshKey || undefined
          }
        ]);

        if (selectedKey === 'manual') {
          const { manualPath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'manualPath',
              message: 'Enter SSH key path:',
              default: profile.sshKey
            }
          ]);
          sshKeyPath = manualPath;
        } else if (selectedKey !== 'skip') {
          sshKeyPath = selectedKey;
        }
      } else {
        const { manualPath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'manualPath',
            message: 'Enter SSH key path:',
            default: profile.sshKey
          }
        ]);
        sshKeyPath = manualPath;
      }

      // Validate the SSH key if provided
      if (sshKeyPath && sshKeyPath !== 'skip') {
        const validation = this.ssh.validateKeyPair(sshKeyPath);
        if (!validation.valid) {
          display.error(`SSH key validation failed: ${validation.error}`);
          sshKeyPath = profile.sshKey; // Keep the old value
        }
      }
    }

    // Handle profile rename
    if (answers.newName !== profileName) {
      this.config.renameProfile(profileName, answers.newName);
      
      // Update SSH config if needed
      if (profile.sshKey) {
        this.ssh.removeFromSSHConfig(profileName);
        await this.ssh.updateSSHConfig(answers.newName, profile.sshKey, answers.type);
      }
    }

    // Update profile details
    this.config.updateProfile(answers.newName, {
      name: answers.userName,
      email: answers.email,
      type: answers.type,
      sshKey: sshKeyPath
    });

    display.success(`Profile '${answers.newName}' updated successfully`);
  }

  async removeProfile(profileName, options = {}) {
    const profile = this.config.getProfile(profileName);
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
      this.ssh.removeFromSSHConfig(profileName);
    }

    // Remove profile
    this.config.deleteProfile(profileName);
    display.success(`Profile '${profileName}' removed`);
  }

  async showCurrent() {
    const current = this.config.getCurrentProfile();
    const gitConfig = gitUtils.getCurrentGitConfig();

    if (current) {
      const profile = this.config.getProfile(current);
      display.header(`Current Profile: ${current}`);
      display.listItem('Name', gitConfig.name);
      display.listItem('Email', gitConfig.email);
      display.listItem('Type', profile.type);
      
      if (profile.sshKey) {
        display.listItem('SSH Key', profile.sshKey);
      }
    } else {
      display.warning('No matching GitSwitch profile for current Git configuration');
      if (gitConfig.name || gitConfig.email) {
        display.listItem('Git Name', gitConfig.name || 'Not set');
        display.listItem('Git Email', gitConfig.email || 'Not set');
      }
    }
  }

  async backup(backupPath) {
    try {
      const path = this.config.backup();
      const finalPath = backupPath || path;
      
      if (backupPath && backupPath !== path) {
        const fs = require('fs');
        fs.copyFileSync(path, backupPath);
      }
      
      display.success(`Configuration backed up to: ${finalPath}`);
    } catch (error) {
      display.error(`Backup failed: ${error.message}`);
    }
  }

  async restore(backupPath, options = {}) {
    if (!require('fs').existsSync(backupPath)) {
      display.error(`Backup file not found: ${backupPath}`);
      return;
    }

    if (this.config.hasProfiles() && !options.force) {
      const { confirm } = await inquirer.prompt([
        prompts.confirmDestructive('This will replace your current configuration. Continue?')
      ]);
      
      if (!confirm) {
        display.info('Restore cancelled');
        return;
      }
    }

    try {
      this.config.restore(backupPath);
      display.success('Configuration restored successfully');
    } catch (error) {
      display.error(`Restore failed: ${error.message}`);
    }
  }

  async manageSSH(action, profileName) {
    switch (action) {
      case 'list':
        const keys = this.ssh.listAvailableKeys();
        if (keys.length === 0) {
          display.info('No SSH keys found');
        } else {
          display.header('Available SSH Keys');
          keys.forEach(key => {
            display.listItem(key.name, key.hasPublicKey ? 'Valid' : 'Missing public key',
              key.hasPublicKey ? 'success' : 'warning');
          });
        }
        break;

      case 'add-to-agent':
        if (!profileName) {
          display.error('Profile name required');
          return;
        }
        
        const profile = this.config.getProfile(profileName);
        if (!profile || !profile.sshKey) {
          display.error(`No SSH key configured for profile '${profileName}'`);
          return;
        }

        try {
          this.ssh.addToAgent(profile.sshKey);
          display.success('SSH key added to agent');
        } catch (error) {
          display.error(error.message);
        }
        break;

      case 'remove-from-agent':
        if (!profileName) {
          display.error('Profile name required');
          return;
        }
        
        const acc = this.config.getProfile(profileName);
        if (!acc || !acc.sshKey) {
          display.error(`No SSH key configured for profile '${profileName}'`);
          return;
        }

        if (this.ssh.removeFromAgent(acc.sshKey)) {
          display.success('SSH key removed from agent');
        } else {
          display.info('SSH key was not in agent');
        }
        break;

      case 'validate':
        if (!profileName) {
          // Validate all profiles
          const profiles = this.config.getProfilesDetails();
          display.header('SSH Key Validation');
          
          Object.entries(profiles).forEach(([name, info]) => {
            if (info.sshKey) {
              const validation = this.ssh.validateKeyPair(info.sshKey);
              display.listItem(name, validation.valid ? 'Valid' : validation.error,
                validation.valid ? 'success' : 'error');
            }
          });
        } else {
          // Validate specific profile
          const profileInfo = this.config.getProfile(profileName);
          if (!profileInfo || !profileInfo.sshKey) {
            display.error(`No SSH key configured for profile '${profileName}'`);
            return;
          }

          const validation = this.ssh.validateKeyPair(profileInfo.sshKey);
          if (validation.valid) {
            display.success(`SSH key for '${profileName}' is valid`);
          } else {
            display.error(`SSH key validation failed: ${validation.error}`);
            if (validation.fixable) {
              display.info('This issue can be fixed automatically with proper permissions');
            }
          }
        }
        break;

      case 'test':
        if (!profileName) {
          // Test all profiles with SSH keys
          const profiles = this.config.getProfilesDetails();
          display.header('SSH Connectivity Test');
          
          for (const [name, info] of Object.entries(profiles)) {
            if (info.sshKey) {
              await this.testSSHConnection(name, info);
            }
          }
        } else {
          // Test specific profile
          const profileInfo = this.config.getProfile(profileName);
          if (!profileInfo || !profileInfo.sshKey) {
            display.error(`No SSH key configured for profile '${profileName}'`);
            return;
          }
          
          display.header(`Testing SSH connection for '${profileName}'`);
          await this.testSSHConnection(profileName, profileInfo);
        }
        break;

      default:
        display.error(`Unknown SSH action: ${action}`);
        display.info('Valid actions: list, add-to-agent, remove-from-agent, validate, test');
    }
  }

  async testSSHConnection(profileName, profileInfo) {
    const { execSync } = require('child_process');
    
    display.subheader(`Testing ${profileName} (${profileInfo.type})`);
    
    // Determine the Git host
    const gitHost = profileInfo.type === 'GitHub' ? 'github.com' :
                    profileInfo.type === 'GitLab' ? 'gitlab.com' :
                    profileInfo.type === 'Bitbucket' ? 'bitbucket.org' : null;
    
    if (!gitHost) {
      display.error(`Unknown service type: ${profileInfo.type}`);
      return;
    }
    
    try {
      // Test SSH connection using the specific key
      const command = `ssh -T -o StrictHostKeyChecking=no -o PasswordAuthentication=no -i "${profileInfo.sshKey}" git@${gitHost}`;
      let result = '';
      
      try {
        result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
      } catch (error) {
        // SSH often returns exit code 1 even on success, so we need to check the output
        result = error.stdout || error.stderr || error.toString();
      }
      
      // Check for successful authentication patterns
      if (result.includes('successfully authenticated') || 
          result.includes('Welcome to GitLab') || 
          result.includes('logged in as')) {
        display.success(`✓ SSH key works with ${profileInfo.type}`);
        
        // Extract username if available
        const usernameMatch = result.match(/Hi ([^!]+)!/) || // GitHub
                             result.match(/@([^\s!]+)/) || // GitLab username format
                             result.match(/logged in as ([^.]+)./); // Bitbucket
        
        if (usernameMatch) {
          display.listItem('Authenticated as', usernameMatch[1], 'success');
        }
      } else if (result.includes('Permission denied')) {
        display.error(`✗ SSH key not authorized on ${profileInfo.type}`);
        display.info(`Add your public key at: ${this.ssh.getGitServiceUrl(profileInfo.type)}`);
      } else if (result.includes('Could not resolve hostname')) {
        display.error(`✗ Cannot connect to ${gitHost}`);
      } else {
        // Unknown response
        display.warning(`Unexpected response from ${profileInfo.type}`);
        if (result) {
          display.info(`Response: ${result.trim().substring(0, 100)}...`);
        }
      }
    } catch (error) {
      display.error(`✗ SSH test failed: ${error.message}`);
    }
    
    console.log(); // Empty line for spacing
  }

  async showConfig() {
    display.header('GitSwitch Configuration');
    display.listItem('Config Path', this.config.configPath);
    display.listItem('Profiles', Object.keys(this.config.getProfilesDetails()).length);
    display.listItem('Current Profile', this.config.getCurrentProfile() || 'None');
    
    const configSize = require('fs').statSync(this.config.configPath).size;
    display.listItem('Config Size', `${configSize} bytes`);
  }


  async interactiveMenu() {
    // Check for existing config
    if (!this.config.hasProfiles()) {
      const { init } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'init',
          message: 'No configuration found. Initialize GitSwitch?',
          default: true
        }
      ]);

      if (init) {
        await this.init();
      } else {
        display.info('Run "gitswitch init" to get started');
        return;
      }
    }

    // Show current profile
    const current = this.config.getCurrentProfile();
    if (current) {
      display.info(`Current profile: ${chalk.green(current)}`);
    }

    // Show menu
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        loop: false,
        choices: [
          'Switch Profile',
          'List Profiles',
          'Add New Profile',
          'Edit Profile',
          'Remove Profile',
          new inquirer.Separator(),
          'Manage SSH Keys',
          'Backup Configuration',
          'Show Current Profile',
          new inquirer.Separator(),
          'Exit'
        ]
      }
    ]);

    switch (action) {
      case 'Switch Profile':
        await this.switchProfile();
        break;
      case 'List Profiles':
        await this.listProfiles({ verbose: true });
        break;
      case 'Add New Profile':
        await this.addProfile();
        break;
      case 'Edit Profile':
        const profiles = this.config.getAllProfiles();
        const { profile } = await inquirer.prompt([
          {
            type: 'list',
            name: 'profile',
            message: 'Select profile to edit:',
            loop: false,
            choices: profiles
          }
        ]);
        await this.editProfile(profile);
        break;
      case 'Remove Profile':
        const accs = this.config.getAllProfiles();
        const { acc } = await inquirer.prompt([
          {
            type: 'list',
            name: 'acc',
            message: 'Select profile to remove:',
            loop: false,
            choices: accs
          }
        ]);
        await this.removeProfile(acc);
        break;
      case 'Manage SSH Keys':
        const { sshAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'sshAction',
            message: 'SSH Key Management:',
            loop: false,
            choices: [
              'List available keys',
              'Test SSH connections',
              'Add key to SSH agent',
              'Remove key from SSH agent',
              'Validate SSH keys'
            ]
          }
        ]);
        
        const actionMap = {
          'List available keys': 'list',
          'Test SSH connections': 'test',
          'Add key to SSH agent': 'add-to-agent',
          'Remove key from SSH agent': 'remove-from-agent',
          'Validate SSH keys': 'validate'
        };
        
        const mappedAction = actionMap[sshAction];
        let selectedAccount = null;
        
        if (mappedAction === 'add-to-agent' || mappedAction === 'remove-from-agent') {
          const accountsWithKeys = Object.entries(this.config.getAccountsDetails())
            .filter(([_, info]) => info.sshKey)
            .map(([name, _]) => name);
            
          if (accountsWithKeys.length === 0) {
            display.error('No accounts have SSH keys configured');
            return;
          }
          
          const { profile } = await inquirer.prompt([
            {
              type: 'list',
              name: 'profile',
              message: 'Select account:',
              loop: false,
              choices: profilesWithKeys
            }
          ]);
          selectedProfile = profile;
        }
        
        await this.manageSSH(mappedAction, selectedAccount);
        break;
      case 'Backup Configuration':
        await this.backup();
        break;
      case 'Show Current Profile':
        await this.showCurrent();
        break;
      case 'Exit':
        display.info('Goodbye!');
        return;
    }

  }
}

async function main() {
  try {
    // Check Git installation
    if (!gitUtils.isGitInstalled()) {
      display.error('Git is not installed or not in PATH');
      process.exit(1);
    }

    const gitswitch = new GitSwitch();
    const args = parseArguments();

    // Set color preference
    if (args.options.color === false) {
      chalk.level = 0;
    }

    // Handle commands
    switch (args.command) {
      case 'init':
        await gitswitch.init(args.options);
        break;
      
      case 'switch':
      case 'use':
        await gitswitch.switchAccount(args.args.account, args.options);
        break;
      
      case 'list':
      case 'ls':
        await gitswitch.listAccounts(args.options);
        break;
      
      case 'add':
        await gitswitch.addAccount(args.args.name, args.options);
        break;
      
      case 'edit':
        await gitswitch.editAccount(args.args.name);
        break;
      
      case 'remove':
      case 'rm':
      case 'delete':
        await gitswitch.removeAccount(args.args.name, args.options);
        break;
      
      case 'current':
        await gitswitch.showCurrent();
        break;
      
      case 'backup':
        await gitswitch.backup(args.args.path);
        break;
      
      case 'restore':
        await gitswitch.restore(args.args.path, args.options);
        break;
      
      case 'ssh':
        await gitswitch.manageSSH(args.args.action, args.args.account);
        break;
      
      case 'config':
        await gitswitch.showConfig();
        break;
      
      case 'help':
        // Show full help from commander
        const { setupCLI } = require('./lib/cli');
        const helpProgram = setupCLI();
        helpProgram.outputHelp();
        break;
        
      case 'interactive':
      default:
        await gitswitch.interactiveMenu();
        break;
    }
  } catch (error) {
    errorHandler.handle(error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = GitSwitch;