const inquirer = require('inquirer');
const chalk = require('chalk');
const { gitUtils, display } = require('../utils');
const { testSSHConnection } = require('./shared/test-ssh');

async function switchCommand(config, ssh, profileName = null, options = {}) {
  if (!config.hasProfiles()) {
    display.error('No profiles configured. Run "gitprofile init" first');
    return;
  }

  let selectedProfile = profileName;

  if (!selectedProfile) {
    const profiles = config.getAllProfiles();
    const currentProfile = config.getCurrentProfile();

    const { profile } = await inquirer.prompt([
      {
        type: 'list',
        name: 'profile',
        message: 'Select a profile to switch to:',
        loop: false,
        choices: profiles.map(prof => ({
          name: prof === currentProfile ? `${prof} ${chalk.green('(current)')}` : prof,
          value: prof
        }))
      }
    ]);
    
    selectedProfile = profile;
  }

  const profileData = config.getProfile(selectedProfile);
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
  config.updateLastUsed(selectedProfile);

  // Handle SSH key loading
  if (profileData.sshKey) {
    // Remove all existing keys from SSH agent
    try {
      gitUtils.execCommand('ssh-add -D', { silent: true });
      display.info('Cleared SSH agent');
    } catch (error) {
      // Ignore errors if no keys were loaded
    }

    // Add the profile's SSH key to the agent
    try {
      gitUtils.execCommand(`ssh-add "${profileData.sshKey}"`);
      display.success(`Loaded SSH key: ${profileData.sshKey}`);
    } catch (error) {
      display.error(`Failed to load SSH key: ${error.message}`);
    }
  }

  // Test SSH connection if configured
  if (profileData.sshKey && profileData.type) {
    await testSSHConnection(profileData.sshKey, profileData.type, ssh);
  }
}


module.exports = { switchCommand };