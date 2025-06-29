const chalk = require('chalk');
const { execSync } = require('child_process');
const { display } = require('../../utils');

async function testSSHConnection(sshKeyPath, profileType, ssh) {
  process.stdout.write('\nTesting SSH connection... ');
  
  const gitHost = profileType === 'GitHub' ? 'github.com' :
                  profileType === 'GitLab' ? 'gitlab.com' :
                  profileType === 'Bitbucket' ? 'bitbucket.org' : null;
  
  if (!gitHost) {
    console.log(chalk.yellow('?'));
    display.listItem('SSH Connection', 'Unknown service type', 'warning');
    return;
  }

  try {
    const command = `ssh -T -o StrictHostKeyChecking=no -o PasswordAuthentication=no -i "${sshKeyPath}" git@${gitHost}`;
    let result = '';
    
    try {
      result = execSync(command, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      // SSH test commands often exit with non-zero even on success
      result = error.stdout || error.stderr || error.toString();
    }
    
    if (result.includes('successfully authenticated') || 
        result.includes('Welcome to GitLab') || 
        result.includes('logged in as')) {
      console.log(chalk.green('✓'));
      display.listItem('SSH Connection', 'Confirmed', 'success');
    } else if (result.includes('Permission denied')) {
      console.log(chalk.red('✗'));
      display.listItem('SSH Connection', 'Key not yet authorized', 'warning');
      display.info(`Remember to add your key at: ${ssh.getGitServiceUrl(profileType)}`);
    } else {
      console.log(chalk.yellow('?'));
      display.listItem('SSH Connection', 'Unknown status', 'warning');
    }
  } catch (error) {
    console.log(chalk.red('✗'));
    display.listItem('SSH Connection', 'Test failed', 'error');
    if (process.env.DEBUG) {
      console.error(error);
    }
  }
}

module.exports = { testSSHConnection };