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
        await gitProfile.addProfile(args.name || args[0], options);
        break;

      case 'switch':
      case 'use':
        await gitProfile.switchProfile(args.profile || args[0], options);
        break;

      case 'list':
      case 'ls':
        await gitProfile.listProfiles(options);
        break;

      case 'edit':
        const editProfile = args.name || args[0];
        if (!editProfile) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitProfile.editProfile(editProfile);
        break;

      case 'remove':
      case 'rm':
      case 'delete':
        const removeProfile = args.name || args[0];
        if (!removeProfile) {
          display.error('Profile name required');
          process.exit(1);
        }
        await gitProfile.removeProfile(removeProfile, options);
        break;

      case 'current':
        await gitProfile.showCurrent();
        break;

      case 'ssh':
        if (!args.action) {
          display.error('Usage: gitprofile ssh <action> [profile]');
          process.exit(1);
        }
        await gitProfile.manageSSH(args.action, args.profile);
        break;

      case 'backup':
        await gitProfile.backup(args.path || args[0]);
        break;

      case 'restore':
        const restorePath = args.path || args[0];
        if (!restorePath) {
          display.error('Backup file path required');
          process.exit(1);
        }
        await gitProfile.restore(restorePath, options);
        break;

      case 'config':
        await gitProfile.showConfig();
        break;

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