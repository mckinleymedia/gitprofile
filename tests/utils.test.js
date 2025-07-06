const { validators, ValidationError, gitUtils } = require('../lib/utils');
const { execSync } = require('child_process');

jest.mock('child_process');

describe('Utils', () => {
  describe('validators', () => {
    describe('email', () => {
      it('should accept valid email addresses', () => {
        expect(() => validators.email('user@example.com')).not.toThrow();
        expect(() => validators.email('test.name+tag@example.co.uk')).not.toThrow();
      });

      it('should reject invalid email addresses', () => {
        expect(() => validators.email('invalid')).toThrow(ValidationError);
        expect(() => validators.email('@example.com')).toThrow(ValidationError);
        expect(() => validators.email('user@')).toThrow(ValidationError);
        expect(() => validators.email('')).toThrow('Invalid email format');
      });
    });

    describe('profileName', () => {
      it('should accept valid profile names', () => {
        expect(() => validators.profileName('work')).not.toThrow();
        expect(() => validators.profileName('my-profile')).not.toThrow();
        expect(() => validators.profileName('profile_123')).not.toThrow();
      });

      it('should reject invalid profile names', () => {
        expect(() => validators.profileName('')).toThrow('Profile name is required');
        expect(() => validators.profileName('   ')).toThrow('Profile name cannot be empty');
        expect(() => validators.profileName('a'.repeat(51))).toThrow('Profile name is too long');
        expect(() => validators.profileName('profile@name')).toThrow('Profile name can only contain');
      });
    });

    describe('gitUserName', () => {
      it('should accept valid git user names', () => {
        expect(() => validators.gitUserName('John Doe')).not.toThrow();
        expect(() => validators.gitUserName('user-name')).not.toThrow();
      });

      it('should reject empty names', () => {
        expect(() => validators.gitUserName('')).toThrow('Git user name is required');
        expect(() => validators.gitUserName('   ')).toThrow('Git user name cannot be empty');
      });
    });

    describe('filePath', () => {
      it('should accept valid file paths', () => {
        expect(() => validators.filePath('/home/user/file.txt')).not.toThrow();
        expect(() => validators.filePath('./relative/path')).not.toThrow();
      });

      it('should reject empty paths', () => {
        expect(() => validators.filePath('')).toThrow('File path is required');
      });
    });
  });

  describe('gitUtils', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('getCurrentGitConfig', () => {
      it('should return current git config', () => {
        execSync.mockImplementation((cmd) => {
          if (cmd.includes('user.name')) return 'John Doe\n';
          if (cmd.includes('user.email')) return 'john@example.com\n';
        });

        const config = gitUtils.getCurrentGitConfig();
        expect(config).toEqual({
          name: 'John Doe',
          email: 'john@example.com'
        });
      });

      it('should return empty strings on error', () => {
        execSync.mockImplementation(() => {
          throw new Error('Git not found');
        });

        const config = gitUtils.getCurrentGitConfig();
        expect(config).toEqual({
          name: '',
          email: ''
        });
      });
    });

    describe('setGitConfig', () => {
      it('should set git config values', () => {
        execSync.mockImplementation(() => {}); // Mock successful execution
        gitUtils.setGitConfig('John Doe', 'john@example.com');
        
        expect(execSync).toHaveBeenCalledWith('git config --global user.name "John Doe"', { stdio: 'pipe' });
        expect(execSync).toHaveBeenCalledWith('git config --global user.email "john@example.com"', { stdio: 'pipe' });
      });

      it('should throw error on failure', () => {
        execSync.mockImplementation(() => {
          throw new Error('Git error');
        });

        expect(() => gitUtils.setGitConfig('John', 'john@example.com'))
          .toThrow('Failed to set git config: Git error');
      });
    });

    describe('isGitInstalled', () => {
      it('should return true when git is installed', () => {
        execSync.mockImplementation(() => 'git version 2.34.0\n');
        expect(gitUtils.isGitInstalled()).toBe(true);
      });

      it('should return false when git is not installed', () => {
        execSync.mockImplementation(() => {
          throw new Error('Command not found');
        });
        expect(gitUtils.isGitInstalled()).toBe(false);
      });
    });
  });
});