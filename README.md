# GitSwitch

A professional Git account switcher with SSH key management for GitHub, GitLab, and Bitbucket.

## Features

- **Multiple Account Management**: Easily switch between different Git accounts
- **SSH Key Management**: Generate, validate, and manage SSH keys for each account
- **Service Support**: Works with GitHub, GitLab, and Bitbucket
- **Interactive & CLI Modes**: Use interactive menus or command-line arguments
- **SSH Config Integration**: Automatically updates SSH config for seamless Git operations
- **Backup & Restore**: Save and restore your configuration
- **Colored Output**: Beautiful, easy-to-read terminal output
- **Validation**: Built-in validation for emails, account names, and SSH keys

## Installation

### Global Installation

```bash
npm install -g gitswitch
```

### Local Development

```bash
git clone https://github.com/mckinleymedia/gitswitch.git
cd gitswitch
npm install
npm link
```

## Quick Start

1. **Initialize GitSwitch** with your current Git configuration:
   ```bash
   gitswitch init
   ```

2. **Add a new account**:
   ```bash
   gitswitch add work --email work@company.com --name "John Doe" --generate-ssh
   ```

3. **Switch accounts**:
   ```bash
   gitswitch switch work
   ```

## Commands

### Interactive Mode

Simply run `gitswitch` without any arguments to enter interactive mode:

```bash
gitswitch
```

This will present you with a menu of options to manage your Git accounts.

### Command Line Interface

#### `init`
Initialize GitSwitch with your current Git configuration.

```bash
gitswitch init [options]
```

Options:
- `-f, --force` - Force reinitialization

#### `add`
Add a new Git account.

```bash
gitswitch add <name> [options]
```

Options:
- `-e, --email <email>` - Git email for this account
- `-n, --name <name>` - Git user name for this account
- `-t, --type <type>` - Account type (GitHub, GitLab, Bitbucket)
- `--generate-ssh` - Generate a new SSH key
- `--ssh-key <path>` - Path to existing SSH key

Example:
```bash
gitswitch add personal --email me@example.com --name "Jane Doe" --generate-ssh
```

#### `switch` / `use`
Switch to a different Git account.

```bash
gitswitch switch [account] [options]
```

Options:
- `-s, --ssh` - Also add SSH key to agent

Example:
```bash
gitswitch switch work --ssh
```

#### `list` / `ls`
List all configured accounts.

```bash
gitswitch list [options]
```

Options:
- `-v, --verbose` - Show detailed information
- `--json` - Output in JSON format

#### `edit`
Edit an existing account.

```bash
gitswitch edit <name>
```

#### `remove` / `rm` / `delete`
Remove an account.

```bash
gitswitch remove <name> [options]
```

Options:
- `-f, --force` - Skip confirmation prompt

#### `current`
Show the currently active account.

```bash
gitswitch current
```

#### `ssh`
Manage SSH keys.

```bash
gitswitch ssh <action> [account]
```

Actions:
- `list` - List available SSH keys
- `add-to-agent` - Add key to SSH agent
- `remove-from-agent` - Remove key from SSH agent
- `validate` - Validate SSH keys

Examples:
```bash
gitswitch ssh list
gitswitch ssh add-to-agent work
gitswitch ssh validate
```

#### `backup`
Backup the GitSwitch configuration.

```bash
gitswitch backup [path]
```

#### `restore`
Restore GitSwitch configuration from a backup.

```bash
gitswitch restore <path> [options]
```

Options:
- `-f, --force` - Overwrite without confirmation

#### `config`
Show GitSwitch configuration details.

```bash
gitswitch config
```

### Global Options

- `-q, --quiet` - Suppress non-essential output
- `-y, --yes` - Automatically answer yes to prompts
- `--no-color` - Disable colored output
- `-h, --help` - Show help
- `-V, --version` - Show version

## SSH Key Management

GitSwitch provides comprehensive SSH key management:

### Automatic SSH Key Generation

When adding an account with `--generate-ssh`, GitSwitch will:
1. Generate a new Ed25519 SSH key (more secure than RSA)
2. Save it with a descriptive name in `~/.ssh/`
3. Copy the public key to your clipboard
4. Provide the URL to add the key to your Git service

### SSH Config Integration

GitSwitch can automatically update your `~/.ssh/config` file to create host aliases:

```
# GitSwitch - work
Host github-work
    HostName github.com
    User git
    IdentityFile ~/.ssh/id_rsa_work
    IdentitiesOnly yes
```

This allows you to clone repositories using:
```bash
git clone git@github-work:username/repo.git
```

### SSH Agent Management

Easily add or remove keys from your SSH agent:

```bash
# Add key to agent
gitswitch ssh add-to-agent work

# Remove key from agent
gitswitch ssh remove-from-agent work
```

## Configuration

GitSwitch stores its configuration in `~/.gitswitch.json`. Each account entry includes:

- Git user name and email
- SSH key paths
- Account type (GitHub, GitLab, Bitbucket)
- Creation date and last used timestamp

### Example Configuration

```json
{
  "accounts": {
    "work": {
      "name": "John Doe",
      "email": "john@company.com",
      "sshKey": "/Users/john/.ssh/id_ed25519_work",
      "type": "GitHub",
      "createdAt": "2025-05-15T10:30:00.000Z",
      "lastUsed": "2025-06-09T14:20:00.000Z"
    }
  }
}
```

## Best Practices

1. **Use descriptive account names**: Choose names that clearly identify the account (e.g., "work", "personal", "client-xyz")

2. **Generate separate SSH keys**: Use a unique SSH key for each account for better security

3. **Regular backups**: Backup your configuration regularly:
   ```bash
   gitswitch backup ~/Documents/gitswitch-backup.json
   ```

4. **Validate SSH keys**: Periodically validate your SSH keys:
   ```bash
   gitswitch ssh validate
   ```

## Troubleshooting

### SSH Key Issues

If you encounter SSH authentication issues:

1. **Validate your keys**:
   ```bash
   gitswitch ssh validate
   ```

2. **Check if the key is in the agent**:
   ```bash
   ssh-add -l
   ```

3. **Ensure correct permissions**:
   ```bash
   chmod 600 ~/.ssh/id_*
   chmod 644 ~/.ssh/id_*.pub
   ```

### Git Config Not Updating

If Git configuration doesn't update:

1. Check current Git config:
   ```bash
   git config --global user.name
   git config --global user.email
   ```

2. Manually set if needed:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your@email.com"
   ```

## Security Considerations

- SSH keys are stored with secure permissions (600)
- No passwords or sensitive data are stored in the configuration
- SSH keys are never transmitted or shared
- Configuration backups should be stored securely

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details