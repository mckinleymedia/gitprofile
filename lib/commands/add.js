const inquirer = require('inquirer');
const chalk = require('chalk');
const { validators, display, prompts } = require('../utils');

async function addCommand(config, ssh, profileName = null, options = {}) {
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
          if (config.getProfile(input)) {
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
  
  if (finalAnswers.generateSshKey) {
    sshKeyPath = await handleSSHKeyGeneration(ssh, finalAnswers, options);
  } else if (finalAnswers.sshKey) {
    sshKeyPath = await handleExistingSSHKey(ssh, finalAnswers.sshKey);
  }

  // Save profile
  config.addProfile(finalAnswers.profileName, {
    name: finalAnswers.name,
    email: finalAnswers.email,
    sshKey: sshKeyPath,
    type: finalAnswers.profileType
  });

  display.success(`Profile '${finalAnswers.profileName}' added successfully`);
  
  // Test SSH connection if configured
  if (sshKeyPath && finalAnswers.profileType) {
    await testSSHConnection(sshKeyPath, finalAnswers.profileType, ssh);
  }
}

async function handleSSHKeyGeneration(ssh, answers, options) {
  const sshKeyPath = ssh.generateKeyPath(answers.profileName);
  
  if (ssh.keyExists(sshKeyPath)) {
    const { regenerate } = await inquirer.prompt([
      prompts.confirmDestructive(`SSH key already exists at ${sshKeyPath}. Regenerate?`)
    ]);
    
    if (regenerate) {
      const { confirm } = await inquirer.prompt([
        prompts.confirmTyped('This will overwrite the existing key', 'yes')
      ]);
      
      if (confirm === 'yes') {
        await ssh.generateKey(answers.email, sshKeyPath);
        display.success('SSH key regenerated');
      } else {
        display.info('Keeping existing SSH key');
        return sshKeyPath;
      }
    } else {
      return sshKeyPath;
    }
  } else {
    await ssh.generateKey(answers.email, sshKeyPath);
    display.success('SSH key generated');
  }

  const publicKey = ssh.getPublicKey(sshKeyPath);
  
  const { copyToClipboard } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'copyToClipboard',
      message: 'Copy public key to clipboard?',
      default: true
    }
  ]);

  if (copyToClipboard) {
    await ssh.copyToClipboard(publicKey);
    display.success('Public key copied to clipboard');
  }

  const setupUrl = ssh.getGitServiceUrl(answers.profileType);
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
      const hostAlias = await ssh.updateSSHConfig(
        answers.profileName,
        sshKeyPath,
        answers.profileType
      );
      display.success(`SSH config updated. Use '${hostAlias}' as the host in Git URLs`);
      display.info(`Example: git clone git@${hostAlias}:username/repo.git`);
    }
  }

  return sshKeyPath;
}

async function handleExistingSSHKey(ssh, sshKeyPath) {
  const validation = ssh.validateKeyPair(sshKeyPath);
  
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
        ssh.fixKeyPermissions(sshKeyPath);
        display.success('Permissions fixed');
      }
    } else {
      throw new Error(validation.error);
    }
  }
  
  return sshKeyPath;
}

async function testSSHConnection(sshKeyPath, profileType, ssh) {
  process.stdout.write('\nTesting SSH connection... ');
  
  const gitHost = profileType === 'GitHub' ? 'github.com' :
                  profileType === 'GitLab' ? 'gitlab.com' :
                  profileType === 'Bitbucket' ? 'bitbucket.org' : null;
  
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
        display.info(`Remember to add your key at: ${ssh.getGitServiceUrl(profileType)}`);
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

module.exports = { addCommand };