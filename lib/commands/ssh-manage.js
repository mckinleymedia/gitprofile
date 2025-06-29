const { display, gitUtils } = require('../utils');

async function sshManageCommand(config, ssh, action, profileName) {
  switch (action) {
    case 'list':
      await listSSHKeys(ssh);
      break;

    case 'add-to-agent':
      await addKeyToAgent(config, ssh, profileName);
      break;

    case 'remove-from-agent':
      await removeKeyFromAgent(config, ssh, profileName);
      break;

    case 'validate':
      await validateAllKeys(config, ssh);
      break;

    case 'test':
      if (!profileName) {
        display.error('Profile name required for SSH test');
        return;
      }
      await testSSHConnection(config, ssh, profileName);
      break;

    default:
      display.error(`Unknown SSH action: ${action}`);
      display.info('Available actions: list, add-to-agent, remove-from-agent, validate, test');
  }
}

async function listSSHKeys(ssh) {
  const keys = ssh.listAvailableKeys();
  if (keys.length === 0) {
    display.info('No SSH keys found');
  } else {
    display.header('Available SSH Keys');
    keys.forEach(key => {
      display.listItem(key.name, key.hasPublicKey ? 'Valid' : 'Missing public key',
        key.hasPublicKey ? 'success' : 'warning');
    });
  }
}

async function addKeyToAgent(config, ssh, profileName) {
  if (!profileName) {
    display.error('Profile name required');
    return;
  }
  
  const profile = config.getProfile(profileName);
  if (!profile || !profile.sshKey) {
    display.error(`No SSH key configured for profile '${profileName}'`);
    return;
  }

  if (!gitUtils.isSSHAgentRunning()) {
    display.warning('SSH agent is not running');
    return;
  }

  if (ssh.isKeyInAgent(profile.sshKey)) {
    display.info('SSH key is already in agent');
    return;
  }

  try {
    ssh.addToAgent(profile.sshKey);
    display.success('SSH key added to agent');
  } catch (error) {
    display.error(error.message);
  }
}

async function removeKeyFromAgent(config, ssh, profileName) {
  if (!profileName) {
    display.error('Profile name required');
    return;
  }
  
  const profile = config.getProfile(profileName);
  if (!profile || !profile.sshKey) {
    display.error(`No SSH key configured for profile '${profileName}'`);
    return;
  }

  try {
    ssh.removeFromAgent(profile.sshKey);
    display.success('SSH key removed from agent');
  } catch (error) {
    display.error(`Failed to remove key from agent: ${error.message}`);
  }
}

async function validateAllKeys(config, ssh) {
  const profiles = config.getProfilesDetails();
  let hasIssues = false;

  display.header('SSH Key Validation');

  for (const [name, profile] of Object.entries(profiles)) {
    if (profile.sshKey) {
      const validation = ssh.validateKeyPair(profile.sshKey);
      if (validation.valid) {
        display.listItem(`${name}`, 'Valid', 'success');
      } else {
        hasIssues = true;
        display.listItem(`${name}`, validation.error, 'error');
        if (validation.fixable) {
          display.info(`  Run: gitprofile ssh fix ${name}`);
        }
      }
    } else {
      display.listItem(`${name}`, 'No SSH key configured', 'warning');
    }
  }

  if (!hasIssues) {
    display.success('All SSH keys are valid');
  }
}

async function testSSHConnection(config, ssh, profileName) {
  const profile = config.getProfile(profileName);
  if (!profile) {
    display.error(`Profile '${profileName}' not found`);
    return;
  }

  if (!profile.sshKey) {
    display.error(`No SSH key configured for profile '${profileName}'`);
    return;
  }

  const { testSSHConnection } = require('./shared/test-ssh');
  await testSSHConnection(profile.sshKey, profile.type, ssh);
}

module.exports = { sshManageCommand };