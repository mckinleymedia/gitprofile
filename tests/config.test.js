const fs = require('fs');
const path = require('path');
const ConfigManager = require('../lib/config');

// Mock fs module
jest.mock('fs');

describe('ConfigManager', () => {
  let configManager;
  const mockConfigPath = path.join(process.env.HOME || process.env.USERPROFILE, '.gitprofile.json');
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Mock fs.existsSync to return false by default
    fs.existsSync.mockReturnValue(false);
    
    configManager = new ConfigManager();
  });

  describe('constructor', () => {
    it('should initialize with empty profiles when config file does not exist', () => {
      expect(configManager.config).toEqual({ profiles: {} });
    });

    it('should load existing config when file exists', () => {
      const mockConfig = {
        profiles: {
          work: {
            name: 'John Doe',
            email: 'john@work.com',
            sshKey: '/path/to/key',
            type: 'GitHub'
          }
        }
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockConfig));

      configManager = new ConfigManager();
      expect(configManager.config).toEqual(mockConfig);
    });
  });

  describe('save', () => {
    it('should save config to file', () => {
      fs.writeFileSync.mockImplementation(() => {});
      
      const result = configManager.save();
      
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        mockConfigPath,
        JSON.stringify(configManager.config, null, 2)
      );
      expect(result).toBe(true);
    });

    it('should return false on save error', () => {
      fs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = configManager.save();
      
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('reset', () => {
    it('should reset config to empty state', () => {
      fs.writeFileSync.mockImplementation(() => {});
      
      configManager.config.profiles = { test: {} };
      configManager.reset();
      
      expect(configManager.config).toEqual({ profiles: {} });
    });
  });

  describe('addProfile', () => {
    beforeEach(() => {
      fs.writeFileSync.mockImplementation(() => {});
    });

    it('should add a new profile', () => {
      const profileData = {
        name: 'John Doe',
        email: 'john@example.com',
        sshKey: '/path/to/key',
        type: 'GitHub'
      };

      configManager.addProfile('personal', profileData);
      
      expect(configManager.config.profiles.personal).toBeDefined();
      expect(configManager.config.profiles.personal.name).toBe('John Doe');
      expect(configManager.config.profiles.personal.email).toBe('john@example.com');
    });

    it('should throw error if profile already exists', () => {
      configManager.config.profiles.existing = {};
      
      expect(() => {
        configManager.addProfile('existing', {});
      }).toThrow("Profile 'existing' already exists");
    });

    it('should throw error if name or data is missing', () => {
      expect(() => {
        configManager.addProfile();
      }).toThrow('Profile name and data are required');
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      fs.writeFileSync.mockImplementation(() => {});
      configManager.config.profiles.existing = {
        name: 'Old Name',
        email: 'old@email.com'
      };
    });

    it('should update existing profile', () => {
      configManager.updateProfile('existing', {
        name: 'New Name'
      });
      
      expect(configManager.config.profiles.existing.name).toBe('New Name');
      expect(configManager.config.profiles.existing.email).toBe('old@email.com');
      expect(configManager.config.profiles.existing.updatedAt).toBeDefined();
    });

    it('should throw error if profile does not exist', () => {
      expect(() => {
        configManager.updateProfile('nonexistent', {});
      }).toThrow("Profile 'nonexistent' does not exist");
    });
  });

  describe('deleteProfile', () => {
    beforeEach(() => {
      fs.writeFileSync.mockImplementation(() => {});
      configManager.config.profiles.toDelete = {};
    });

    it('should delete existing profile', () => {
      configManager.deleteProfile('toDelete');
      
      expect(configManager.config.profiles.toDelete).toBeUndefined();
    });

    it('should throw error if profile does not exist', () => {
      expect(() => {
        configManager.deleteProfile('nonexistent');
      }).toThrow("Profile 'nonexistent' does not exist");
    });
  });

  describe('getProfile', () => {
    it('should return profile if exists', () => {
      const profile = { name: 'Test', email: 'test@example.com' };
      configManager.config.profiles.test = profile;
      
      expect(configManager.getProfile('test')).toEqual(profile);
    });

    it('should return null if profile does not exist', () => {
      expect(configManager.getProfile('nonexistent')).toBeNull();
    });
  });

  describe('getAllProfiles', () => {
    it('should return all profile names', () => {
      configManager.config.profiles = {
        personal: { name: 'Personal' },
        work: { name: 'Work' }
      };
      
      const profileNames = configManager.getAllProfiles();
      expect(profileNames).toHaveLength(2);
      expect(profileNames).toContain('personal');
      expect(profileNames).toContain('work');
    });
  });

  describe('getProfilesDetails', () => {
    it('should return all profile details', () => {
      configManager.config.profiles = {
        personal: { name: 'Personal' },
        work: { name: 'Work' }
      };
      
      const profiles = configManager.getProfilesDetails();
      expect(Object.keys(profiles)).toHaveLength(2);
      expect(profiles.personal.name).toBe('Personal');
      expect(profiles.work.name).toBe('Work');
    });
  });

  describe('hasProfiles', () => {
    it('should return true when profiles exist', () => {
      configManager.config.profiles.test = {};
      expect(configManager.hasProfiles()).toBe(true);
    });

    it('should return false when no profiles exist', () => {
      expect(configManager.hasProfiles()).toBe(false);
    });
  });
});