const chalk = require('chalk');
const { execSync } = require('child_process');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class GitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GitError';
  }
}

const validators = {
  email(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      throw new ValidationError('Invalid email format');
    }
    return email.trim();
  },

  profileName(name) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Profile name is required');
    }
    
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Profile name cannot be empty');
    }
    
    if (trimmed.length > 50) {
      throw new ValidationError('Profile name is too long (max 50 characters)');
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      throw new ValidationError('Profile name can only contain letters, numbers, hyphens, and underscores');
    }
    
    return trimmed;
  },

  gitUserName(name) {
    if (!name || typeof name !== 'string') {
      throw new ValidationError('Git user name is required');
    }
    
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new ValidationError('Git user name cannot be empty');
    }
    
    return trimmed;
  },

  filePath(path) {
    if (!path || typeof path !== 'string') {
      throw new ValidationError('File path is required');
    }
    
    // Basic path validation - more specific validation should be done by the caller
    return path.trim();
  },

  gitServiceType(type) {
    const validTypes = ['GitHub', 'GitLab', 'Bitbucket', 'Gitea'];
    if (!validTypes.includes(type)) {
      throw new ValidationError(`Invalid service type. Must be one of: ${validTypes.join(', ')}`);
    }
    return type;
  }
};

const gitUtils = {
  isGitInstalled() {
    try {
      execSync('git --version', { stdio: 'pipe' });
      return true;
    } catch (error) {
      return false;
    }
  },

  getCurrentGitConfig() {
    try {
      const name = execSync('git config --global user.name', { stdio: 'pipe' })
        .toString()
        .trim();
      const email = execSync('git config --global user.email', { stdio: 'pipe' })
        .toString()
        .trim();
      
      return { name, email };
    } catch (error) {
      return { name: '', email: '' };
    }
  },

  setGitConfig(name, email) {
    try {
      if (name) {
        execSync(`git config --global user.name "${name}"`, { stdio: 'pipe' });
      }
      if (email) {
        execSync(`git config --global user.email "${email}"`, { stdio: 'pipe' });
      }
      return true;
    } catch (error) {
      throw new GitError(`Failed to set git config: ${error.message}`);
    }
  },

  isSSHAgentRunning() {
    try {
      execSync('ssh-add -l', { stdio: 'pipe' });
      return true;
    } catch (error) {
      // Exit code 1 means agent is running but has no keys
      // Exit code 2 means agent is not running
      return error.status === 1;
    }
  },

  startSSHAgent() {
    try {
      const output = execSync('eval $(ssh-agent -s)', { shell: true, stdio: 'pipe' })
        .toString();
      return output.includes('Agent pid');
    } catch (error) {
      return false;
    }
  },

  execCommand(command, options = {}) {
    try {
      const result = execSync(command, { 
        stdio: options.silent ? 'pipe' : 'inherit',
        encoding: 'utf8'
      });
      return result ? result.toString().trim() : '';
    } catch (error) {
      throw new Error(error.message);
    }
  }
};

const display = {
  success(message) {
    console.log(chalk.green('✓'), message);
  },

  error(message) {
    console.error(chalk.red('✗'), message);
  },

  warning(message) {
    console.log(chalk.yellow('⚠'), message);
  },

  info(message) {
    console.log(chalk.blue('ℹ'), message);
  },

  header(message) {
    console.log('\n' + chalk.bold.underline(message));
  },

  subheader(message) {
    console.log(chalk.bold(message));
  },

  listItem(label, value, status = null) {
    const formattedLabel = chalk.gray(`${label}:`);
    let formattedValue = value;
    
    if (status === 'success') {
      formattedValue = chalk.green(value);
    } else if (status === 'warning') {
      formattedValue = chalk.yellow(value);
    } else if (status === 'error') {
      formattedValue = chalk.red(value);
    }
    
    console.log(`  ${formattedLabel} ${formattedValue}`);
  },

  separator() {
    console.log(chalk.gray('─'.repeat(50)));
  },

  keyValue(key, value) {
    console.log(`${chalk.bold(key)}: ${value}`);
  },

  table(data, headers) {
    if (!data || data.length === 0) return;

    // Calculate column widths
    const columnWidths = headers.map((header, index) => {
      const values = data.map(row => String(row[index] || ''));
      return Math.max(header.length, ...values.map(v => v.length));
    });

    // Print header
    const headerRow = headers.map((header, index) => 
      header.padEnd(columnWidths[index])
    ).join('  ');
    console.log(chalk.bold(headerRow));
    console.log(chalk.gray('─'.repeat(headerRow.length)));

    // Print data
    data.forEach(row => {
      const dataRow = row.map((cell, index) => 
        String(cell || '').padEnd(columnWidths[index])
      ).join('  ');
      console.log(dataRow);
    });
  }
};

const errorHandler = {
  handle(error, context = '') {
    if (error instanceof ValidationError) {
      display.error(`Validation error: ${error.message}`);
    } else if (error instanceof GitError) {
      display.error(`Git error: ${error.message}`);
    } else if (error.code === 'ENOENT') {
      display.error(`File or directory not found: ${error.path}`);
    } else if (error.code === 'EACCES') {
      display.error(`Permission denied: ${error.path}`);
    } else if (error.code === 'EEXIST') {
      display.error(`File already exists: ${error.path}`);
    } else {
      display.error(`${context ? context + ': ' : ''}${error.message}`);
    }

    if (process.env.DEBUG) {
      console.error(chalk.gray('\nStack trace:'));
      console.error(chalk.gray(error.stack));
    }
  },

  async handleAsync(fn, context = '') {
    try {
      return await fn();
    } catch (error) {
      this.handle(error, context);
      throw error;
    }
  }
};

const prompts = {
  confirmDestructive(message) {
    return {
      type: 'confirm',
      name: 'confirm',
      message: chalk.yellow(`⚠ ${message}`),
      default: false
    };
  },

  confirmTyped(message, confirmText = 'yes') {
    return {
      type: 'input',
      name: 'confirm',
      message: `${message} Type "${confirmText}" to confirm:`,
      validate: (input) => input === confirmText ? true : `Please type "${confirmText}" to confirm`
    };
  }
};

module.exports = {
  ValidationError,
  GitError,
  validators,
  gitUtils,
  display,
  errorHandler,
  prompts
};