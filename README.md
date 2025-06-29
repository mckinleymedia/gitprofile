# git-switch-cli

A professional Git account switcher with SSH key management for GitHub, GitLab, and Bitbucket.

## Features

- 🔄 Quick switching between multiple Git accounts
- 🔑 Automatic SSH key generation and management
- 🔒 Secure storage of account configurations
- 🎯 Support for GitHub, GitLab, and Bitbucket
- 📋 Account listing with current status
- ✏️ Easy account editing and removal
- 🔍 SSH connection testing
- 📝 Interactive and command-line modes

## Installation

```bash
npm install -g git-switch-cli
```

Or using yarn:

```bash
yarn global add git-switch-cli
```

## Usage

### Initialize GitSwitch

Set up your first Git account:

```bash
git-switch-cli init
```

### Add a New Account

Add additional Git accounts:

```bash
git-switch-cli add
```

### Switch Accounts

Switch to a different account:

```bash
# Interactive mode (select from list)
git-switch-cli switch

# Direct switch
git-switch-cli switch work

# Using the short alias
gitsw switch personal
```

### List All Accounts

View all configured accounts:

```bash
git-switch-cli list
```

### Edit an Account

Modify account details:

```bash
git-switch-cli edit <account-name>
```

### Remove an Account

Delete an account configuration:

```bash
git-switch-cli remove <account-name>
```

### Generate SSH Key

Create a new SSH key for an account:

```bash
git-switch-cli ssh <account-name>
```

## Command Reference

```
Commands:
  init [options]                Initialize GitSwitch with your first account
  add [options]                 Add a new Git account
  switch [account] [options]    Switch to a different Git account
  list [options]                List all Git accounts
  edit <account>                Edit an existing account
  remove <account>              Remove a Git account
  ssh <account> [options]       Generate new SSH key for an account
  current                       Show current Git configuration
  help [command]                Display help for command

Options:
  -V, --version                 output the version number
  -h, --help                    display help for command
```

## SSH Key Management

GitSwitch automatically manages SSH keys for your accounts:

1. **Key Generation**: Creates Ed25519 SSH keys (most secure and efficient)
2. **Key Storage**: Saves keys in `~/.ssh/` with proper permissions (600)
3. **Connection Testing**: Automatically tests SSH connectivity when switching accounts
4. **Service URLs**: Provides direct links to add your public keys to GitHub/GitLab/Bitbucket

### Adding SSH Keys to Git Services

After generating an SSH key, add it to your Git service:

- **GitHub**: https://github.com/settings/keys
- **GitLab**: https://gitlab.com/-/profile/keys
- **Bitbucket**: https://bitbucket.org/account/settings/ssh-keys/

## Configuration

GitSwitch stores its configuration in `~/.gitswitch.json`. This file contains:

- Account names and emails
- SSH key paths
- Git service types
- Account metadata

### Backup

GitSwitch automatically creates backups before destructive operations.

## Security

- SSH keys are stored with secure permissions (600)
- No passwords or tokens are stored
- All operations use native Git and SSH commands
- SSH connections explicitly disable password authentication

## Examples

### Setting Up Multiple Work and Personal Accounts

```bash
# Initialize with personal account
git-switch-cli init
# Enter: personal, John Doe, john@personal.com, GitHub

# Add work account
git-switch-cli add
# Enter: work, John Doe, john@company.com, GitLab

# Switch between accounts
gitsw switch work
gitsw switch personal
```

### Managing SSH Keys

```bash
# Generate new SSH key for work account
git-switch-cli ssh work

# The public key will be copied to clipboard
# Add it to your GitLab account settings
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