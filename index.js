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

    if (this.config.hasAccounts() && !options.force) {
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

    // Ask for account details
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'accountName',
        message: 'Enter a name for the current account:',
        default: currentConfig.email || 'default',
        validate: (input) => {
          try {
            validators.accountName(input);
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'list',
        name: 'accountType',
        message: 'Select the account type:',
        loop: false,
        choices: ['GitHub', 'GitLab', 'Bitbucket'],
        default: 'GitHub'
      }
    ]);

    // Save current account
    this.config.addAccount(answers.accountName, {
      name: currentConfig.name,
      email: currentConfig.email,
      type: answers.accountType
    });

    display.success(`Account '${answers.accountName}' saved`);

    // Ask if user wants to add another account
    const { addAnother } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'addAnother',
        message: 'Do you want to add another account?',
        default: false
      }
    ]);

    if (addAnother) {
      await this.addAccount();
    }

    display.success('GitSwitch initialization complete');
  }

  async addAccount(accountName = null, options = {}) {
    display.header('Add New Account');

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'accountName',
        message: 'Enter a name for this account:',
        default: accountName,
        when: !accountName,
        validate: (input) => {
          try {
            validators.accountName(input);
            if (this.config.getAccount(input)) {
              return `Account '${input}' already exists`;
            }
            return true;
          } catch (error) {
            return error.message;
          }
        }
      },
      {
        type: 'list',
        name: 'accountType',
        message: 'Select the account type:',
        loop: false,
        choices: ['GitHub', 'GitLab', 'Bitbucket'],
        default: options.type || 'GitHub',
        when: !options.type
      },
      {
        type: 'input',
        name: 'name',
        message: 'Enter the Git user name for this account:',
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
        message: 'Enter the Git email for this account:',
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
        message: 'Do you want to generate a new SSH key for this account?',
        default: options.generateSsh || false,
        when: !options.sshKey && options.generateSsh === undefined
      }
    ]);

    // Merge CLI options with interactive answers
    const finalAnswers = {
      accountName: accountName || answers.accountName,
      accountType: options.type || answers.accountType,
      name: options.name || answers.name,
      email: options.email || answers.email,
      generateSshKey: options.generateSsh || answers.generateSshKey,
      sshKey: options.sshKey
    };

    // Handle SSH key
    let sshKeyPath = '';
    let publicKey = '';

    if (finalAnswers.generateSshKey) {
      sshKeyPath = this.ssh.generateKeyPath(finalAnswers.accountName);
      
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

      const setupUrl = this.ssh.getGitServiceUrl(finalAnswers.accountType);
      display.info(`Add your SSH key at: ${chalk.underline(setupUrl)}`);
      
      // Update SSH config
      if (!options.quiet) {
        const { updateConfig } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'updateConfig',
            message: 'Add this account to SSH config for easier Git operations?',
            default: true
          }
        ]);

        if (updateConfig) {
          const hostAlias = await this.ssh.updateSSHConfig(
            finalAnswers.accountName,
            sshKeyPath,
            finalAnswers.accountType
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

    // Save account
    this.config.addAccount(finalAnswers.accountName, {
      name: finalAnswers.name,
      email: finalAnswers.email,
      sshKey: sshKeyPath,
      type: finalAnswers.accountType
    });

    display.success(`Account '${finalAnswers.accountName}' added successfully`);
  }

  async switchAccount(accountName = null, options = {}) {
    if (!this.config.hasAccounts()) {
      display.error('No accounts configured. Run "gitswitch init" first');
      return;
    }

    let selectedAccount = accountName;

    if (!selectedAccount) {
      const accounts = this.config.getAllAccounts();
      const currentAccount = this.config.getCurrentAccount();

      const { account } = await inquirer.prompt([
        {
          type: 'list',
          name: 'account',
          message: 'Select an account to switch to:',
          loop: false,
          choices: accounts.map(acc => ({
            name: acc === currentAccount ? `${acc} ${chalk.green('(current)')}` : acc,
            value: acc
          }))
        }
      ]);
      
      selectedAccount = account;
    }

    const accountData = this.config.getAccount(selectedAccount);
    if (!accountData) {
      display.error(`Account '${selectedAccount}' not found`);
      return;
    }

    // Switch Git config
    gitUtils.setGitConfig(accountData.name, accountData.email);
    display.success(`Switched to account: ${selectedAccount}`);
    display.listItem('Name', accountData.name);
    display.listItem('Email', accountData.email);
    display.listItem('Type', accountData.type);

    // Update last used
    this.config.updateLastUsed(selectedAccount);

    // Handle SSH key
    if (accountData.sshKey) {
      display.listItem('SSH Key', accountData.sshKey);
      
      if (options.ssh || (!options.quiet && !options.ssh)) {
        const shouldAddKey = options.ssh || (await inquirer.prompt([
          {
            type: 'confirm',
            name: 'addToAgent',
            message: 'Add SSH key to agent?',
            default: false
          }
        ])).addToAgent;

        if (shouldAddKey) {
          if (!gitUtils.isSSHAgentRunning()) {
            display.warning('SSH agent is not running');
            const { startAgent } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'startAgent',
                message: 'Start SSH agent?',
                default: true
              }
            ]);

            if (startAgent && gitUtils.startSSHAgent()) {
              display.success('SSH agent started');
            }
          }

          if (!this.ssh.isKeyInAgent(accountData.sshKey)) {
            try {
              this.ssh.addToAgent(accountData.sshKey);
              display.success('SSH key added to agent');
            } catch (error) {
              display.error(`Failed to add key to agent: ${error.message}`);
            }
          } else {
            display.info('SSH key is already in agent');
          }
        }
      }
    }
  }

  async listAccounts(options = {}) {
    if (!this.config.hasAccounts()) {
      display.error('No accounts configured');
      return;
    }

    const accounts = this.config.getAccountsDetails();
    const currentAccount = this.config.getCurrentAccount();

    if (options.json) {
      console.log(JSON.stringify(accounts, null, 2));
      return;
    }

    display.header('Configured Accounts');

    if (options.verbose) {
      Object.entries(accounts).forEach(([name, info]) => {
        display.separator();
        display.subheader(`Account: ${name}${name === currentAccount ? ' ' + chalk.green('(current)') : ''}`);
        display.listItem('Name', info.name);
        display.listItem('Email', info.email);
        display.listItem('Type', info.type || 'Unknown');
        display.listItem('SSH Key', info.sshKey || 'Not configured');
        
        if (info.sshKey) {
          const validation = this.ssh.validateKeyPair(info.sshKey);
          if (validation.valid) {
            const inAgent = this.ssh.isKeyInAgent(info.sshKey);
            display.listItem('SSH Status', inAgent ? 'Active in agent' : 'Not in agent', 
              inAgent ? 'success' : 'warning');
          } else {
            display.listItem('SSH Status', validation.error, 'error');
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
      const tableData = Object.entries(accounts).map(([name, info]) => [
        name + (name === currentAccount ? ' *' : ''),
        info.name,
        info.email,
        info.type || 'Unknown'
      ]);
      
      display.table(tableData, ['Account', 'Name', 'Email', 'Type']);
      
      if (currentAccount) {
        console.log(chalk.gray('\n* Currently active'));
      }
    }
  }

  async editAccount(accountName) {
    const account = this.config.getAccount(accountName);
    if (!account) {
      display.error(`Account '${accountName}' not found`);
      return;
    }

    display.header(`Edit Account: ${accountName}`);

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: 'New account name (identifier):',
        default: accountName,
        validate: (input) => {
          try {
            validators.accountName(input);
            if (input !== accountName && this.config.getAccount(input)) {
              return `Account '${input}' already exists`;
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
        default: account.name,
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
        default: account.email,
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
        message: 'Account type:',
        loop: false,
        choices: ['GitHub', 'GitLab', 'Bitbucket'],
        default: account.type || 'GitHub'
      }
    ]);

    // Ask about SSH key
    let sshKeyPath = account.sshKey || '';
    const { updateSshKey } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'updateSshKey',
        message: account.sshKey ? 'Update SSH key?' : 'Add SSH key?',
        default: !account.sshKey
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
            default: account.sshKey || undefined
          }
        ]);

        if (selectedKey === 'manual') {
          const { manualPath } = await inquirer.prompt([
            {
              type: 'input',
              name: 'manualPath',
              message: 'Enter SSH key path:',
              default: account.sshKey
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
            default: account.sshKey
          }
        ]);
        sshKeyPath = manualPath;
      }

      // Validate the SSH key if provided
      if (sshKeyPath && sshKeyPath !== 'skip') {
        const validation = this.ssh.validateKeyPair(sshKeyPath);
        if (!validation.valid) {
          display.error(`SSH key validation failed: ${validation.error}`);
          sshKeyPath = account.sshKey; // Keep the old value
        }
      }
    }

    // Handle account rename
    if (answers.newName !== accountName) {
      this.config.renameAccount(accountName, answers.newName);
      
      // Update SSH config if needed
      if (account.sshKey) {
        this.ssh.removeFromSSHConfig(accountName);
        await this.ssh.updateSSHConfig(answers.newName, account.sshKey, answers.type);
      }
    }

    // Update account details
    this.config.updateAccount(answers.newName, {
      name: answers.userName,
      email: answers.email,
      type: answers.type,
      sshKey: sshKeyPath
    });

    display.success(`Account '${answers.newName}' updated successfully`);
  }

  async removeAccount(accountName, options = {}) {
    const account = this.config.getAccount(accountName);
    if (!account) {
      display.error(`Account '${accountName}' not found`);
      return;
    }

    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        prompts.confirmDestructive(`Remove account '${accountName}'?`)
      ]);
      
      if (!confirm) {
        display.info('Removal cancelled');
        return;
      }
    }

    // Remove from SSH config
    if (account.sshKey) {
      this.ssh.removeFromSSHConfig(accountName);
    }

    // Remove account
    this.config.deleteAccount(accountName);
    display.success(`Account '${accountName}' removed`);
  }

  async showCurrent() {
    const current = this.config.getCurrentAccount();
    const gitConfig = gitUtils.getCurrentGitConfig();

    if (current) {
      const account = this.config.getAccount(current);
      display.header(`Current Account: ${current}`);
      display.listItem('Name', gitConfig.name);
      display.listItem('Email', gitConfig.email);
      display.listItem('Type', account.type);
      
      if (account.sshKey) {
        const inAgent = this.ssh.isKeyInAgent(account.sshKey);
        display.listItem('SSH Key', account.sshKey);
        display.listItem('SSH Status', inAgent ? 'Active in agent' : 'Not in agent',
          inAgent ? 'success' : 'warning');
      }
    } else {
      display.warning('No matching GitSwitch account for current Git configuration');
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

    if (this.config.hasAccounts() && !options.force) {
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

  async manageSSH(action, accountName) {
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
        if (!accountName) {
          display.error('Account name required');
          return;
        }
        
        const account = this.config.getAccount(accountName);
        if (!account || !account.sshKey) {
          display.error(`No SSH key configured for account '${accountName}'`);
          return;
        }

        try {
          this.ssh.addToAgent(account.sshKey);
          display.success('SSH key added to agent');
        } catch (error) {
          display.error(error.message);
        }
        break;

      case 'remove-from-agent':
        if (!accountName) {
          display.error('Account name required');
          return;
        }
        
        const acc = this.config.getAccount(accountName);
        if (!acc || !acc.sshKey) {
          display.error(`No SSH key configured for account '${accountName}'`);
          return;
        }

        if (this.ssh.removeFromAgent(acc.sshKey)) {
          display.success('SSH key removed from agent');
        } else {
          display.info('SSH key was not in agent');
        }
        break;

      case 'validate':
        if (!accountName) {
          // Validate all accounts
          const accounts = this.config.getAccountsDetails();
          display.header('SSH Key Validation');
          
          Object.entries(accounts).forEach(([name, info]) => {
            if (info.sshKey) {
              const validation = this.ssh.validateKeyPair(info.sshKey);
              display.listItem(name, validation.valid ? 'Valid' : validation.error,
                validation.valid ? 'success' : 'error');
            }
          });
        } else {
          // Validate specific account
          const accountInfo = this.config.getAccount(accountName);
          if (!accountInfo || !accountInfo.sshKey) {
            display.error(`No SSH key configured for account '${accountName}'`);
            return;
          }

          const validation = this.ssh.validateKeyPair(accountInfo.sshKey);
          if (validation.valid) {
            display.success(`SSH key for '${accountName}' is valid`);
          } else {
            display.error(`SSH key validation failed: ${validation.error}`);
            if (validation.fixable) {
              display.info('This issue can be fixed automatically with proper permissions');
            }
          }
        }
        break;

      default:
        display.error(`Unknown SSH action: ${action}`);
        display.info('Valid actions: list, add-to-agent, remove-from-agent, validate');
    }
  }

  async showConfig() {
    display.header('GitSwitch Configuration');
    display.listItem('Config Path', this.config.configPath);
    display.listItem('Accounts', Object.keys(this.config.getAccountsDetails()).length);
    display.listItem('Current Account', this.config.getCurrentAccount() || 'None');
    
    const configSize = require('fs').statSync(this.config.configPath).size;
    display.listItem('Config Size', `${configSize} bytes`);
  }


  async interactiveMenu() {
    // Check for existing config
    if (!this.config.hasAccounts()) {
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

    // Show current account
    const current = this.config.getCurrentAccount();
    if (current) {
      display.info(`Current account: ${chalk.green(current)}`);
    }

    // Show menu
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        loop: false,
        choices: [
          'Switch Account',
          'List Accounts',
          'Add New Account',
          'Edit Account',
          'Remove Account',
          new inquirer.Separator(),
          'Manage SSH Keys',
          'Backup Configuration',
          'Show Current Account',
          new inquirer.Separator(),
          'Exit'
        ]
      }
    ]);

    switch (action) {
      case 'Switch Account':
        await this.switchAccount();
        break;
      case 'List Accounts':
        await this.listAccounts({ verbose: true });
        break;
      case 'Add New Account':
        await this.addAccount();
        break;
      case 'Edit Account':
        const accounts = this.config.getAllAccounts();
        const { account } = await inquirer.prompt([
          {
            type: 'list',
            name: 'account',
            message: 'Select account to edit:',
            loop: false,
            choices: accounts
          }
        ]);
        await this.editAccount(account);
        break;
      case 'Remove Account':
        const accs = this.config.getAllAccounts();
        const { acc } = await inquirer.prompt([
          {
            type: 'list',
            name: 'acc',
            message: 'Select account to remove:',
            loop: false,
            choices: accs
          }
        ]);
        await this.removeAccount(acc);
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
              'Add key to SSH agent',
              'Remove key from SSH agent',
              'Validate SSH keys'
            ]
          }
        ]);
        
        const actionMap = {
          'List available keys': 'list',
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
          
          const { account } = await inquirer.prompt([
            {
              type: 'list',
              name: 'account',
              message: 'Select account:',
              loop: false,
              choices: accountsWithKeys
            }
          ]);
          selectedAccount = account;
        }
        
        await this.manageSSH(mappedAction, selectedAccount);
        break;
      case 'Backup Configuration':
        await this.backup();
        break;
      case 'Show Current Account':
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