const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const clipboardy = require('clipboardy');
const SSHKeyManager = require('../lib/ssh');

// Mock modules
jest.mock('fs');
jest.mock('child_process');
jest.mock('clipboardy');

describe('SSHKeyManager', () => {
  let sshManager;
  const mockHomeDir = '/mock/home';
  const mockSSHDir = '/mock/home/.ssh';
  
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.HOME = mockHomeDir;
    sshManager = new SSHKeyManager();
  });

  describe('constructor', () => {
    it('should set SSH directory based on HOME env', () => {
      expect(sshManager.sshDir).toBe(mockSSHDir);
    });
  });

  describe('generateKeyPath', () => {
    it('should generate proper key path with sanitized name', () => {
      const keyPath = sshManager.generateKeyPath('my-work@email.com');
      expect(keyPath).toBe(path.join(mockSSHDir, 'id_rsa_my_work_email_com'));
    });

    it('should handle special characters in profile name', () => {
      const keyPath = sshManager.generateKeyPath('test!@#$%^&*()');
      expect(keyPath).toBe(path.join(mockSSHDir, 'id_rsa_test__________'));
    });
  });

  describe('generateKey', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.mkdirSync.mockImplementation(() => {});
      fs.chmodSync.mockImplementation(() => {});
      execSync.mockImplementation(() => {});
    });

    it('should generate SSH key without passphrase', async () => {
      await sshManager.generateKey('test@example.com', '/mock/key/path');
      
      expect(execSync).toHaveBeenCalledWith(
        expect.stringContaining('ssh-keygen -t ed25519 -C "test@example.com"'),
        { stdio: 'pipe' }
      );
      expect(fs.chmodSync).toHaveBeenCalledWith('/mock/key/path', 0o600);
      expect(fs.chmodSync).toHaveBeenCalledWith('/mock/key/path.pub', 0o644);
    });

    it('should create SSH directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      
      await sshManager.generateKey('test@example.com', '/mock/key/path');
      
      expect(fs.mkdirSync).toHaveBeenCalledWith(mockSSHDir, {
        recursive: true,
        mode: 0o700
      });
    });

    it('should throw error on key generation failure', async () => {
      execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });

      await expect(
        sshManager.generateKey('test@example.com', '/mock/key/path')
      ).rejects.toThrow('Failed to generate SSH key');
    });
  });

  describe('keyExists', () => {
    it('should return true when both private and public keys exist', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/mock/key' || path === '/mock/key.pub';
      });
      
      expect(sshManager.keyExists('/mock/key')).toBe(true);
    });

    it('should return false when private key is missing', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/mock/key.pub';
      });
      
      expect(sshManager.keyExists('/mock/key')).toBe(false);
    });

    it('should return false when public key is missing', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/mock/key';
      });
      
      expect(sshManager.keyExists('/mock/key')).toBe(false);
    });
  });

  describe('getPublicKey', () => {
    it('should read and return public key content', () => {
      const mockPublicKey = 'ssh-ed25519 AAAAC3... test@example.com';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(mockPublicKey + '\n');
      
      const result = sshManager.getPublicKey('/mock/key');
      expect(result).toBe(mockPublicKey);
    });

    it('should throw error when public key does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      expect(() => sshManager.getPublicKey('/mock/key'))
        .toThrow('Public key not found at /mock/key.pub');
    });

    it('should throw error on read failure', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read failed');
      });
      
      expect(() => sshManager.getPublicKey('/mock/key'))
        .toThrow('Failed to read public key');
    });
  });

  describe('copyToClipboard', () => {
    it('should successfully copy content to clipboard', async () => {
      clipboardy.write.mockResolvedValue();
      
      const result = await sshManager.copyToClipboard('test content');
      expect(result).toBe(true);
      expect(clipboardy.write).toHaveBeenCalledWith('test content');
    });

    it('should return false on clipboard failure', async () => {
      clipboardy.write.mockRejectedValue(new Error('Clipboard error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      const result = await sshManager.copyToClipboard('test content');
      expect(result).toBe(false);
      
      consoleSpy.mockRestore();
    });
  });

  describe('getKeyFingerprint', () => {
    it('should return key fingerprint', () => {
      execSync.mockReturnValue('2048 SHA256:abcd1234... test@example.com (RSA)\n');
      
      const fingerprint = sshManager.getKeyFingerprint('/mock/key');
      expect(fingerprint).toBe('SHA256:abcd1234...');
    });

    it('should return null on error', () => {
      execSync.mockImplementation(() => {
        throw new Error('Command failed');
      });
      
      const fingerprint = sshManager.getKeyFingerprint('/mock/key');
      expect(fingerprint).toBeNull();
    });
  });

  describe('isKeyInAgent', () => {
    it('should return true when key is in agent', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('ssh-keygen -l')) {
          return '2048 SHA256:abcd1234... test@example.com (RSA)\n';
        }
        if (cmd === 'ssh-add -l') {
          return '2048 SHA256:abcd1234... test@example.com (RSA)\n';
        }
      });
      
      expect(sshManager.isKeyInAgent('/mock/key')).toBe(true);
    });

    it('should return false when key is not in agent', () => {
      execSync.mockImplementation((cmd) => {
        if (cmd.includes('ssh-keygen -l')) {
          return '2048 SHA256:abcd1234... test@example.com (RSA)\n';
        }
        if (cmd === 'ssh-add -l') {
          return '2048 SHA256:different... other@example.com (RSA)\n';
        }
      });
      
      expect(sshManager.isKeyInAgent('/mock/key')).toBe(false);
    });

    it('should return false on agent error', () => {
      execSync.mockImplementation(() => {
        throw new Error('No agent');
      });
      
      expect(sshManager.isKeyInAgent('/mock/key')).toBe(false);
    });
  });

  describe('addToAgent', () => {
    it('should add key to agent successfully', () => {
      execSync.mockImplementation(() => {});
      
      const result = sshManager.addToAgent('/mock/key');
      expect(result).toBe(true);
      expect(execSync).toHaveBeenCalledWith('ssh-add "/mock/key"', { stdio: 'pipe' });
    });

    it('should throw error on failure', () => {
      execSync.mockImplementation(() => {
        throw new Error('Add failed');
      });
      
      expect(() => sshManager.addToAgent('/mock/key'))
        .toThrow('Failed to add key to SSH agent');
    });
  });

  describe('validateKeyPair', () => {
    it('should validate existing key pair with correct permissions', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ 
        mode: 0o100600,
        isFile: () => true
      }); // -rw-------
      execSync.mockImplementation(() => {}); // Mock successful key validation
      
      const result = sshManager.validateKeyPair('/mock/key');
      expect(result).toEqual({ valid: true });
    });

    it('should detect missing private key', () => {
      fs.existsSync.mockImplementation((path) => path.endsWith('.pub'));
      
      const result = sshManager.validateKeyPair('/mock/key');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Private key not found');
    });

    it('should detect incorrect permissions', () => {
      fs.existsSync.mockReturnValue(true);
      fs.statSync.mockReturnValue({ 
        mode: 0o100644,
        isFile: () => true
      }); // -rw-r--r--
      
      const result = sshManager.validateKeyPair('/mock/key');
      expect(result.valid).toBe(false);
      expect(result.fixable).toBe(true);
      expect(result.error).toContain('Insecure permissions');
    });
  });

  describe('getGitServiceUrl', () => {
    it('should return GitHub SSH keys URL', () => {
      const url = sshManager.getGitServiceUrl('GitHub');
      expect(url).toBe('https://github.com/settings/ssh/new');
    });

    it('should return GitLab SSH keys URL', () => {
      const url = sshManager.getGitServiceUrl('GitLab');
      expect(url).toBe('https://gitlab.com/-/profile/keys');
    });

    it('should return Bitbucket SSH keys URL', () => {
      const url = sshManager.getGitServiceUrl('Bitbucket');
      expect(url).toBe('https://bitbucket.org/account/settings/ssh-keys/');
    });

    it('should return GitHub URL for unknown service', () => {
      const url = sshManager.getGitServiceUrl('Unknown');
      expect(url).toBe('https://github.com/settings/ssh/new');
    });
  });
});