const inquirer = require('inquirer');
const { validators, gitUtils, display, prompts } = require('../utils');

async function initCommand(config, options = {}) {
  display.header('Initializing GitProfile');

  if (config.hasProfiles() && !options.force) {
    const { proceed } = await inquirer.prompt([
      prompts.confirmDestructive('Configuration already exists. Do you want to reinitialize?')
    ]);
    
    if (!proceed) {
      display.info('Initialization cancelled');
      return;
    }
  }

  // Reset config
  config.reset();
  
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
  config.addProfile(answers.profileName, {
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
    // Import addProfile command when needed to avoid circular dependencies
    const { addCommand } = require('./add');
    await addCommand(config);
  }

  display.header('GitProfile initialized successfully!');
}

module.exports = { initCommand };