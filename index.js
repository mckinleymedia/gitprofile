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
        process.exit(0);

      case 'add':
        await gitProfile.addProfile(args.name || args[0], options);
        process.exit(0);

      case 'switch':
      case 'use':
        await gitProfile.switchProfile(args.profile || args[0], options);
        process.exit(0);

      case 'list':
      case 'ls':
        await gitProfile.listProfiles(options);
        process.exit(0);

      case 'edit':
        const editProfile = args.name || args[0];
        if (!editProfile) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitProfile.editProfile(editProfile);
        process.exit(0);

      case 'remove':
      case 'rm':
      case 'delete':
        const removeProfile = args.name || args[0];
        if (!removeProfile) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitProfile.removeProfile(removeProfile, options);
        process.exit(0);

      case 'current':
        await gitProfile.showCurrent();
        process.exit(0);

      case 'ssh':
        if (!args.action) {
          display.error('Usage: gitprofile ssh <action> [profile]');
          process.exit(1);
        }
        await gitProfile.manageSSH(args.action, args.profile);
        process.exit(0);

      case 'backup':
        await gitProfile.backup(args.path || args[0]);
        process.exit(0);

      case 'restore':
        const restorePath = args.path || args[0];
        if (!restorePath) {
          display.error('Backup file path required');
          process.exit(1);
        }
        await gitProfile.restore(restorePath, options);
        process.exit(0);

      case 'config':
        await gitProfile.showConfig();
        process.exit(0);

      case 'interactive':
      case null:
        await gitProfile.interactiveMenu();
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