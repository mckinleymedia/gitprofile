const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const clipboardy = require('clipboardy');

class SSHKeyManager {
  constructor() {
    this.sshDir = path.join(process.env.HOME || process.env.USERPROFILE, '.ssh');
  }

  generateKeyPath(accountName) {
    const sanitizedName = accountName.replace(/[^a-zA-Z0-9]/g, '_');
    return path.join(this.sshDir, `id_rsa_${sanitizedName}`);
  }

  async generateKey(email, keyPath, passphrase = '') {
    try {
      // Ensure SSH directory exists
      if (!fs.existsSync(this.sshDir)) {
        fs.mkdirSync(this.sshDir, { recursive: true, mode: 0o700 });
      }

      const keyType = 'ed25519'; // More secure and faster than RSA
      const command = passphrase
        ? `ssh-keygen -t ${keyType} -C "${email}" -f "${keyPath}" -N "${passphrase}"`
        : `ssh-keygen -t ${keyType} -C "${email}" -f "${keyPath}" -N ""`;

      execSync(command, { stdio: 'pipe' });
      
      // Set proper permissions
      fs.chmodSync(keyPath, 0o600);
      fs.chmodSync(`${keyPath}.pub`, 0o644);

      return true;
    } catch (error) {
      throw new Error(`Failed to generate SSH key: ${error.message}`);
    }
  }

  keyExists(keyPath) {
    return fs.existsSync(keyPath) && fs.existsSync(`${keyPath}.pub`);
  }

  getPublicKey(keyPath) {
    const pubKeyPath = `${keyPath}.pub`;
    if (!fs.existsSync(pubKeyPath)) {
      throw new Error(`Public key not found at ${pubKeyPath}`);
    }

    try {
      return fs.readFileSync(pubKeyPath, 'utf8').trim();
    } catch (error) {
      throw new Error(`Failed to read public key: ${error.message}`);
    }
  }

  async copyToClipboard(content) {
    try {
      await clipboardy.write(content);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error.message);
      return false;
    }
  }

  getKeyFingerprint(keyPath) {
    try {
      const output = execSync(`ssh-keygen -l -f "${keyPath}"`, { stdio: 'pipe' })
        .toString()
        .trim();
      return output.split(' ')[1]; // Return just the fingerprint
    } catch (error) {
      return null;
    }
  }

  isKeyInAgent(keyPath) {
    try {
      const agentKeys = execSync('ssh-add -l', { stdio: 'pipe' }).toString();
      const fingerprint = this.getKeyFingerprint(keyPath);
      return fingerprint && agentKeys.includes(fingerprint);
    } catch (error) {
      return false;
    }
  }

  addToAgent(keyPath) {
    try {
      execSync(`ssh-add "${keyPath}"`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      throw new Error(`Failed to add key to SSH agent: ${error.message}`);
    }
  }

  removeFromAgent(keyPath) {
    try {
      execSync(`ssh-add -d "${keyPath}"`, { stdio: 'pipe' });
      return true;
    } catch (error) {
      // Key might not be in agent
      return false;
    }
  }

  listAvailableKeys() {
    try {
      if (!fs.existsSync(this.sshDir)) {
        return [];
      }

      const files = fs.readdirSync(this.sshDir);
      const keyFiles = files.filter(file => {
        // Common SSH key patterns
        const patterns = [
          /^id_[a-z]+$/,
          /^id_[a-z]+_.*$/,
          /^.*_rsa$/,
          /^.*_ed25519$/,
          /^.*_ecdsa$/
        ];
        
        return patterns.some(pattern => pattern.test(file)) && 
               !file.endsWith('.pub') &&
               fs.statSync(path.join(this.sshDir, file)).isFile();
      });

      return keyFiles.map(file => ({
        name: file,
        path: path.join(this.sshDir, file),
        hasPublicKey: fs.existsSync(path.join(this.sshDir, `${file}.pub`))
      }));
    } catch (error) {
      console.error('Error listing SSH keys:', error.message);
      return [];
    }
  }

  validateKeyPair(privatePath) {
    try {
      // Check if private key exists and is readable
      if (!fs.existsSync(privatePath)) {
        return { valid: false, error: 'Private key not found' };
      }

      const stats = fs.statSync(privatePath);
      if (!stats.isFile()) {
        return { valid: false, error: 'Path is not a file' };
      }

      // Check permissions (should be 600 or 400)
      const mode = stats.mode & parseInt('777', 8);
      if (mode !== parseInt('600', 8) && mode !== parseInt('400', 8)) {
        return { 
          valid: false, 
          error: `Insecure permissions (${mode.toString(8)}). Should be 600 or 400.`,
          fixable: true
        };
      }

      // Check if public key exists
      const publicPath = `${privatePath}.pub`;
      if (!fs.existsSync(publicPath)) {
        return { valid: false, error: 'Public key not found' };
      }

      // Validate key format
      try {
        execSync(`ssh-keygen -l -f "${privatePath}"`, { stdio: 'pipe' });
      } catch (error) {
        return { valid: false, error: 'Invalid key format' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  fixKeyPermissions(keyPath) {
    try {
      fs.chmodSync(keyPath, 0o600);
      return true;
    } catch (error) {
      throw new Error(`Failed to fix permissions: ${error.message}`);
    }
  }

  getGitServiceUrl(type) {
    const urls = {
      'GitHub': 'https://github.com/settings/ssh/new',
      'GitLab': 'https://gitlab.com/-/profile/keys',
      'Bitbucket': 'https://bitbucket.org/account/settings/ssh-keys/',
      'Gitea': '/user/settings/keys'
    };

    return urls[type] || urls['GitHub'];
  }

  async updateSSHConfig(accountName, keyPath, gitHost) {
    const configPath = path.join(this.sshDir, 'config');
    const hostAlias = `${gitHost.toLowerCase()}-${accountName}`;
    const hostname = gitHost === 'GitHub' ? 'github.com' : 
                     gitHost === 'GitLab' ? 'gitlab.com' : 
                     gitHost === 'Bitbucket' ? 'bitbucket.org' : 'git.example.com';

    const configEntry = `
# GitSwitch - ${accountName}
Host ${hostAlias}
    HostName ${hostname}
    User git
    IdentityFile ${keyPath}
    IdentitiesOnly yes
`;

    try {
      let currentConfig = '';
      if (fs.existsSync(configPath)) {
        currentConfig = fs.readFileSync(configPath, 'utf8');
      }

      // Check if entry already exists
      if (currentConfig.includes(`Host ${hostAlias}`)) {
        // Update existing entry
        const regex = new RegExp(`# GitSwitch - ${accountName}[\\s\\S]*?(?=\\n# |\\n\\n|$)`, 'g');
        currentConfig = currentConfig.replace(regex, configEntry.trim());
      } else {
        // Add new entry
        currentConfig += `\n${configEntry}`;
      }

      fs.writeFileSync(configPath, currentConfig.trim() + '\n', { mode: 0o600 });
      return hostAlias;
    } catch (error) {
      throw new Error(`Failed to update SSH config: ${error.message}`);
    }
  }

  removeFromSSHConfig(accountName) {
    const configPath = path.join(this.sshDir, 'config');
    
    if (!fs.existsSync(configPath)) {
      return true;
    }

    try {
      let currentConfig = fs.readFileSync(configPath, 'utf8');
      const regex = new RegExp(`# GitSwitch - ${accountName}[\\s\\S]*?(?=\\n# |\\n\\n|$)`, 'g');
      currentConfig = currentConfig.replace(regex, '').trim();
      
      fs.writeFileSync(configPath, currentConfig + '\n', { mode: 0o600 });
      return true;
    } catch (error) {
      console.error(`Failed to remove SSH config entry: ${error.message}`);
      return false;
    }
  }
}

module.exports = SSHKeyManager;