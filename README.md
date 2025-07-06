# gitswitch

A professional Git profile manager with SSH key management for GitHub, GitLab, and Bitbucket.

## Features

- 🔄 Quick switching between multiple Git profiles
- 🔑 Automatic SSH key generation and management
- 🔒 Secure storage of profile configurations
- 🎯 Support for GitHub, GitLab, and Bitbucket
- 📋 Profile listing with current status
- ✏️ Easy profile editing and removal
- 🔍 SSH connection testing
- 📝 Interactive and command-line modes

## Installation

```bash
npm install -g @mckinleymedia/gitswitch
```

Or using yarn:

```bash
yarn global add @mckinleymedia/gitswitch
```

## Usage

### Initialize GitSwitch

Set up your first Git profile:

```bash
gitswitch init
```

### Add a New Profile

Add additional Git profiles:

```bash
gitswitch add
```

### Switch Profiles

Switch to a different profile:

```bash
# Interactive mode (select from list)
gitswitch switch

# Direct switch
gitswitch switch work

# Using the short alias
gitswitch switch personal
```

### List All Profiles

View all configured profiles:

```bash
gitswitch list
```

### Edit an Profile

Modify profile details:

```bash
gitswitch edit <profile-name>
```

### Remove an Profile

Delete an profile configuration:

```bash
gitswitch remove <profile-name>
```

### Generate SSH Key

Create a new SSH key for an profile:

```bash
gitswitch ssh <profile-name>
```

## Command Reference

```
Commands:
  init [options]                Initialize GitSwitch with your first profile
  add [options]                 Add a new Git profile
  switch [profile] [options]    Switch to a different Git profile
  list [options]                List all Git profiles
  edit <profile>                Edit an existing profile
  remove <profile>              Remove a Git profile
  ssh <profile> [options]       Generate new SSH key for an profile
  current                       Show current Git configuration
  help [command]                Display help for command

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command
```

## SSH Key Management

GitSwitch automatically manages SSH keys for your profiles:

1. **Key Generation**: Creates Ed25519 SSH keys (most secure and efficient)
2. **Key Storage**: Saves keys in `~/.ssh/` with proper permissions (600)
3. **Connection Testing**: Automatically tests SSH connectivity when switching profiles
4. **Service URLs**: Provides direct links to add your public keys to GitHub/GitLab/Bitbucket

### Adding SSH Keys to Git Services

After generating an SSH key, add it to your Git service:

- **GitHub**: https://github.com/settings/keys
- **GitLab**: https://gitlab.com/-/profile/keys
- **Bitbucket**: https://bitbucket.org/profile/settings/ssh-keys/

## Configuration

GitSwitch stores its configuration in `~/.gitswitch.json`. This file contains:

- Profile names and emails
- SSH key paths
- Git service types
- Profile metadata

### Backup

GitSwitch automatically creates backups before destructive operations.

## Security

- SSH keys are stored with secure permissions (600)
- No passwords or tokens are stored
- All operations use native Git and SSH commands
- SSH connections explicitly disable password authentication

## Examples

### Setting Up Multiple Work and Personal Profiles

```bash
# Initialize with personal profile
gitswitch init
# Enter: personal, John Doe, john@personal.com, GitHub

# Add work profile
gitswitch add
# Enter: work, John Doe, john@company.com, GitLab

# Switch between profiles
gitswitch switch work
gitswitch switch personal
```

### Managing SSH Keys

```bash
# Generate new SSH key for work profile
gitswitch ssh work

# The public key will be copied to clipboard
# Add it to your GitLab profile settings
```

## Troubleshooting

### SSH Connection Issues

If SSH connections fail:

1. Ensure your SSH key is added to the Git service
2. Check key permissions: `ls -la ~/.ssh/`
3. Test connection manually: `ssh -T git@github.com`

### Git Config Not Updating

Ensure you have proper permissions to modify Git config:

```bash
git config --global --list
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Will McKinley** - [mckinleymedia](https://github.com/mckinleymedia)

## Repository

[https://github.com/mckinleymedia/gitswitch](https://github.com/mckinleymedia/gitswitch)