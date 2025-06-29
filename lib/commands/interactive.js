const inquirer = require('inquirer');
const chalk = require('chalk');
const { display } = require('../utils');

async function interactiveMenu(gitProfile) {
  // Check for existing config
  if (!gitProfile.config.hasProfiles()) {
    const { init } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'init',
        message: 'No configuration found. Initialize GitProfile?',
        default: true
      }
    ]);

    if (init) {
      await gitProfile.init();
    } else {
      display.info('Run "gitprofile init" to get started');
      return;
    }
  }

  // Show current profile
  const current = gitProfile.config.getCurrentProfile();
  if (current) {
    display.info(`Current profile: ${chalk.green(current)}`);
  }

  // Main menu loop
  let exit = false;
  while (!exit) {
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
        await gitProfile.switchProfile();
        break;

      case 'List Profiles':
        await gitProfile.listProfiles({ verbose: true });
        break;

      case 'Add New Profile':
        await gitProfile.addProfile();
        break;

      case 'Edit Profile':
        await handleEditProfile(gitProfile);
        break;

      case 'Remove Profile':
        await handleRemoveProfile(gitProfile);
        break;

      case 'Manage SSH Keys':
        await handleSSHManagement(gitProfile);
        break;

      case 'Backup Configuration':
        await gitProfile.backup();
        break;

      case 'Show Current Profile':
        await gitProfile.showCurrent();
        break;

      case 'Exit':
        exit = true;
        display.info('Goodbye!');
        break;
    }

    if (!exit) {
      // Add a blank line for better readability
      console.log();
    }
  }
}

async function handleEditProfile(gitProfile) {
  const profiles = gitProfile.config.getAllProfiles();
  if (profiles.length === 0) {
    display.warning('No profiles to edit');
    return;
  }

  const { profile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: 'Select profile to edit:',
      loop: false,
      choices: profiles
    }
  ]);
  await gitProfile.editProfile(profile);
}

async function handleRemoveProfile(gitProfile) {
  const profiles = gitProfile.config.getAllProfiles();
  if (profiles.length === 0) {
    display.warning('No profiles to remove');
    return;
  }

  const { profile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: 'Select profile to remove:',
      loop: false,
      choices: profiles
    }
  ]);
  await gitProfile.removeProfile(profile);
}

async function handleSSHManagement(gitProfile) {
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
        'Validate SSH keys',
        'Back to main menu'
      ]
    }
  ]);

  switch (sshAction) {
    case 'List available keys':
      await gitProfile.manageSSH('list');
      break;

    case 'Test SSH connections':
      await handleSSHTest(gitProfile);
      break;

    case 'Add key to SSH agent':
      await handleSSHAgentAction(gitProfile, 'add-to-agent');
      break;

    case 'Remove key from SSH agent':
      await handleSSHAgentAction(gitProfile, 'remove-from-agent');
      break;

    case 'Validate SSH keys':
      await gitProfile.manageSSH('validate');
      break;
  }
}

async function handleSSHTest(gitProfile) {
  const profiles = gitProfile.config.getAllProfiles()
    .filter(name => {
      const profile = gitProfile.config.getProfile(name);
      return profile && profile.sshKey;
    });

  if (profiles.length === 0) {
    display.warning('No profiles with SSH keys configured');
    return;
  }

  const { profile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: 'Select profile to test SSH connection:',
      loop: false,
      choices: profiles
    }
  ]);

  await gitProfile.manageSSH('test', profile);
}

async function handleSSHAgentAction(gitProfile, action) {
  const profiles = gitProfile.config.getAllProfiles()
    .filter(name => {
      const profile = gitProfile.config.getProfile(name);
      return profile && profile.sshKey;
    });

  if (profiles.length === 0) {
    display.warning('No profiles with SSH keys configured');
    return;
  }

  const { profile } = await inquirer.prompt([
    {
      type: 'list',
      name: 'profile',
      message: `Select profile to ${action === 'add-to-agent' ? 'add to' : 'remove from'} SSH agent:`,
      loop: false,
      choices: profiles
    }
  ]);

  await gitProfile.manageSSH(action, profile);
}

module.exports = { interactiveMenu };