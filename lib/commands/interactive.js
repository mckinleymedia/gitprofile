const inquirer = require('inquirer');
const chalk = require('chalk');
const { display } = require('../utils');

async function interactiveMenu(gitSwitch) {
  // Check for existing config
  if (!gitSwitch.config.hasProfiles()) {
    const { init } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'init',
        message: 'No configuration found. Initialize GitSwitch?',
        default: true
      }
    ]);

    if (init) {
      await gitSwitch.init();
    } else {
      display.info('Run "gitswitch init" to get started');
      return;
    }
  }

  // Show current profile
  const current = gitSwitch.config.getCurrentProfile();
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
        await gitSwitch.switchProfile();
        break;

      case 'List Profiles':
        await gitSwitch.listProfiles({ verbose: true });
        break;

      case 'Add New Profile':
        await gitSwitch.addProfile();
        break;

      case 'Edit Profile':
        await handleEditProfile(gitSwitch);
        break;

      case 'Remove Profile':
        await handleRemoveProfile(gitSwitch);
        break;

      case 'Manage SSH Keys':
        await handleSSHManagement(gitSwitch);
        break;

      case 'Backup Configuration':
        await gitSwitch.backup();
        break;

      case 'Show Current Profile':
        await gitSwitch.showCurrent();
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

async function handleEditProfile(gitSwitch) {
  const profiles = gitSwitch.config.getAllProfiles();
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
  await gitSwitch.editProfile(profile);
}

async function handleRemoveProfile(gitSwitch) {
  const profiles = gitSwitch.config.getAllProfiles();
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
  await gitSwitch.removeProfile(profile);
}

async function handleSSHManagement(gitSwitch) {
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
      await gitSwitch.manageSSH('list');
      break;

    case 'Test SSH connections':
      await handleSSHTest(gitSwitch);
      break;

    case 'Add key to SSH agent':
      await handleSSHAgentAction(gitSwitch, 'add-to-agent');
      break;

    case 'Remove key from SSH agent':
      await handleSSHAgentAction(gitSwitch, 'remove-from-agent');
      break;

    case 'Validate SSH keys':
      await gitSwitch.manageSSH('validate');
      break;
  }
}

async function handleSSHTest(gitSwitch) {
  const profiles = gitSwitch.config.getAllProfiles()
    .filter(name => {
      const profile = gitSwitch.config.getProfile(name);
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

  await gitSwitch.manageSSH('test', profile);
}

async function handleSSHAgentAction(gitSwitch, action) {
  const profiles = gitSwitch.config.getAllProfiles()
    .filter(name => {
      const profile = gitSwitch.config.getProfile(name);
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

  await gitSwitch.manageSSH(action, profile);
}

module.exports = { interactiveMenu };