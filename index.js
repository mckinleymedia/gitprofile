#!/usr/bin/env node

const GitSwitch = require('./lib/gitswitch');
const { parseArguments } = require('./lib/cli');
const { display, errorHandler } = require('./lib/utils');

async function main() {
  try {
    const { command, args, options } = parseArguments();
    const gitSwitch = new GitSwitch();

    switch (command) {
      case 'init':
        await gitSwitch.init(options);
        process.exit(0);

      case 'add':
        await gitSwitch.addProfile(args.name || args[0], options);
        process.exit(0);

      case 'switch':
      case 'use':
        await gitSwitch.switchProfile(args.profile || args[0], options);
        process.exit(0);

      case 'list':
      case 'ls':
        await gitSwitch.listProfiles(options);
        process.exit(0);

      case 'edit':
        const editProfile = args.name || args[0];
        if (!editProfile) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitSwitch.editProfile(editProfile);
        process.exit(0);

      case 'remove':
      case 'rm':
      case 'delete':
        const removeProfile = args.name || args[0];
        if (!removeProfile) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitSwitch.removeProfile(removeProfile, options);
        process.exit(0);

      case 'current':
        await gitSwitch.showCurrent();
        process.exit(0);

      case 'ssh':
        if (!args.action) {
          display.error('Usage: gitswitch ssh <action> [profile]');
          process.exit(1);
        }
        await gitSwitch.manageSSH(args.action, args.profile);
        process.exit(0);

      case 'backup':
        await gitSwitch.backup(args.path || args[0]);
        process.exit(0);

      case 'restore':
        const restorePath = args.path || args[0];
        if (!restorePath) {
          display.error('Backup file path required');
          process.exit(1);
        }
        await gitSwitch.restore(restorePath, options);
        process.exit(0);

      case 'config':
        await gitSwitch.showConfig();
        process.exit(0);

      case 'interactive':
      case null:
        await gitSwitch.interactiveMenu();
        break;

      default:
        display.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    errorHandler.handle(error);
  }
}

// Run the main function
main();