const inquirer = require('inquirer');
const { validators, display } = require('../utils');

async function editCommand(config, ssh, profileName) {
  const profile = config.getProfile(profileName);
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
          if (input !== profileName && config.getProfile(input)) {
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
    sshKeyPath = await handleSSHKeyUpdate(ssh, profile.sshKey);
    
    // Validate the SSH key if provided
    if (sshKeyPath && sshKeyPath !== 'skip') {
      const validation = ssh.validateKeyPair(sshKeyPath);
      if (!validation.valid) {
        display.error(`SSH key validation failed: ${validation.error}`);
        sshKeyPath = profile.sshKey; // Keep the old value
      }
    }
  }

  // Handle profile rename
  if (answers.newName !== profileName) {
    config.renameProfile(profileName, answers.newName);
    
    // Update SSH config if needed
    if (profile.sshKey) {
      ssh.removeFromSSHConfig(profileName);
      await ssh.updateSSHConfig(answers.newName, profile.sshKey, answers.type);
    }
  }

  // Update profile details
  config.updateProfile(answers.newName, {
    name: answers.userName,
    email: answers.email,
    type: answers.type,
    sshKey: sshKeyPath
  });

  display.success(`Profile '${answers.newName}' updated successfully`);
}

async function handleSSHKeyUpdate(ssh, currentSshKey) {
  // List available SSH keys
  const sshKeys = ssh.listAvailableKeys();
  
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
        default: currentSshKey || undefined
      }
    ]);

    if (selectedKey === 'manual') {
      const { manualPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'manualPath',
          message: 'Enter SSH key path:',
          default: currentSshKey
        }
      ]);
      return manualPath;
    } else if (selectedKey !== 'skip') {
      return selectedKey;
    }
  } else {
    const { manualPath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'manualPath',
        message: 'Enter SSH key path:',
        default: currentSshKey
      }
    ]);
    return manualPath;
  }
  
  return 'skip';
}

module.exports = { editCommand };