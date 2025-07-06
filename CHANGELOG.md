# Changelog

All notable changes to GitProfile will be documented in this file.

## [2.0.0] - 2025-06-09

### Added
- Complete code refactoring with modular architecture
- Command-line argument support using Commander.js
- Comprehensive SSH key management module
- Input validation and error handling utilities
- SSH config file auto-configuration
- Backup and restore functionality
- SSH agent management commands
- JSON output format for list command
- Bitbucket support
- Account creation and last used timestamps
- SSH key validation
- Colored table output for account listing
- Short alias `gitsw` for the command

### Changed
- Improved user experience with better prompts and feedback
- SSH keys now use Ed25519 by default (more secure than RSA)
- Better error messages and validation
- Enhanced interactive menu with separators
- More robust configuration management
- Professional README with comprehensive documentation

### Security
- SSH keys are created with proper permissions (600)
- Added SSH key validation
- Secure handling of configuration files

## [1.2.0] - Previous Version

### Features
- Basic account switching functionality
- SSH key generation
- Interactive menu
- GitHub and GitLab support