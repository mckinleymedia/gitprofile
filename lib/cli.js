const { program } = require('commander');
const packageJson = require('../package.json');

function setupCLI() {
  program
    .name('gitprofile')
    .description(packageJson.description)
    .version(packageJson.version)
    .option('-q, --quiet', 'Suppress non-essential output')
    .option('-y, --yes', 'Automatically answer yes to prompts')
    .option('--no-color', 'Disable colored output')
    .allowUnknownOption()
    .helpOption('-h, --help', 'Show full help with all commands');

  program
    .command('init')
    .description('Initialize GitProfile with your current Git configuration')
    .option('-f, --force', 'Force reinitialization, overwriting existing config')
    .action(() => {});

  program
    .command('switch [profile]')
    .alias('use')
    .description('Switch to a different Git profile')
    .option('-s, --ssh', 'Also add SSH key to agent')
    .action(() => {});

  program
    .command('list')
    .alias('ls')
    .description('List all configured profiles')
    .option('-v, --verbose', 'Show detailed information')
    .option('--json', 'Output in JSON format')
    .action(() => {});

  program
    .command('add <name>')
    .description('Add a new Git profile')
    .option('-e, --email <email>', 'Git email for this profile')
    .option('-n, --name <name>', 'Git user name for this profile')
    .option('-t, --type <type>', 'Profile type (GitHub, GitLab, Bitbucket)', 'GitHub')
    .option('--generate-ssh', 'Generate a new SSH key for this profile')
    .option('--ssh-key <path>', 'Path to existing SSH key')
    .action(() => {});

  program
    .command('edit <name>')
    .description('Edit an existing profile')
    .action(() => {});

  program
    .command('remove <name>')
    .alias('rm')
    .alias('delete')
    .description('Remove a profile')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(() => {});

  program
    .command('current')
    .description('Show the currently active profile')
    .action(() => {});

  program
    .command('backup [path]')
    .description('Backup the GitProfile configuration')
    .action(() => {});

  program
    .command('restore <path>')
    .description('Restore GitProfile configuration from a backup')
    .option('-f, --force', 'Overwrite existing configuration without confirmation')
    .action(() => {});

  program
    .command('ssh <action> [profile]')
    .description('Manage SSH keys (actions: add-to-agent, remove-from-agent, list, validate, test)')
    .action(() => {});

  program
    .command('config')
    .description('Show GitProfile configuration path and details')
    .action(() => {});

  // Custom help
  program.configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name() + ' ' + cmd.aliases().map(a => `(${a})`).join(' ')
  });

  program.addHelpText('after', `
Examples:
  $ gitprofile                        # Enter interactive mode
  $ gitprofile init                   # Initialize with current Git config
  $ gitprofile add work --email work@company.com --generate-ssh
  $ gitprofile switch work            # Switch to work profile
  $ gitprofile list -v                # List all profiles with details
  $ gitprofile ssh add-to-agent work  # Add SSH key to agent

For more information, visit: https://github.com/mckinleymedia/gitprofile`);

  return program;
}

function parseArguments(argv = process.argv) {
  const program = setupCLI();
  
  // Store the parsed result
  let result = null;
  
  // Check if no arguments provided (just 'gitprofile')
  if (argv.length === 2) {
    return { command: 'interactive', args: {}, options: {} };
  }
  
  // Override the action handlers to capture the command and arguments
  program.commands.forEach(cmd => {
    const cmdName = cmd.name();
    const originalAction = cmd._actionHandler;
    
    cmd.action((...args) => {
      // The last argument is always the command object
      const command = args[args.length - 1];
      const options = command.opts();
      
      // Build args object based on command signature
      const argNames = cmd._args.map(arg => arg.name());
      const argValues = args.slice(0, -1);
      const argsObj = {};
      
      argNames.forEach((name, index) => {
        if (argValues[index] !== undefined) {
          argsObj[name] = argValues[index];
        }
      });
      
      result = {
        command: cmdName,
        args: argsObj,
        options: { ...program.opts(), ...options }
      };
    });
  });
  
  // Parse arguments
  program.exitOverride(); // Prevent auto-exit on help
  try {
    program.parse(argv);
  } catch (err) {
    if (err.code === 'commander.help') {
      return { command: 'help', args: {}, options: {} };
    }
    throw err;
  }
  
  // If no command was executed, show help
  const globalOptions = program.opts();
  if (!result) {
    return { command: 'help', args: {}, options: globalOptions };
  }
  
  return result;
}

module.exports = {
  setupCLI,
  parseArguments
};