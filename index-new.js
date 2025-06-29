#!/usr/bin/env node

const GitProfile = require('./lib/gitprofile');
const { parseArguments } = require('./lib/cli');
const { display, errorHandler } = require('./lib/utils');

async function main() {
  try {
    const { command, args, options } = parseArguments();
    const gitProfile = new GitProfile();

    switch (command) {
      case 'init':
        await gitProfile.init(options);
        break;

      case 'add':
        await gitProfile.addProfile(args[0], options);
        break;

      case 'switch':
      case 'use':
        await gitProfile.switchProfile(args[0], options);
        break;

      case 'list':
      case 'ls':
        await gitProfile.listProfiles(options);
        break;

      case 'edit':
        if (!args[0]) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitProfile.editProfile(args[0]);
        break;

      case 'remove':
      case 'rm':
      case 'delete':
        if (!args[0]) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitProfile.removeProfile(args[0], options);
        break;

      case 'current':
        await gitProfile.showCurrent();
        break;

      case 'ssh':
        if (!args[0] || !args[1]) {
          display.error('Usage: gitprofile ssh <action> <profile>');
          process.exit(1);
        }
        await gitProfile.manageSSH(args[0], args[1]);
        break;

      case 'backup':
        await gitProfile.backup(args[0]);
        break;

      case 'restore':
        if (!args[0]) {
          display.error('Backup file path required');
          process.exit(1);
        }
        await gitProfile.restore(args[0], options);
        break;

      case 'config':
        await gitProfile.showConfig();
        break;

      case null:
        await gitProfile.interactiveMenu();
        break;

      default:
        display.error(`Unknown command: ${command}`);
        process.exit(1);
    }
  } catch (error) {
    errorHandler(error);
  }
}

// Run the main function
main();