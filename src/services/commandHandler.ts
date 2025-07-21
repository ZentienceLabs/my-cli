import { Mode } from '../types/index';
import { CLIExecutor } from './cliExecutor';
import { cliDb } from '../utils/storage';
import path from 'path';
import fs from 'fs';

export interface SlashCommand {
  label: string;
  value: string;
  description: string;
  action: () => void;
}

export interface CommandHandlerCallbacks {
  setMode: (mode: Mode) => void;
  setCommand: (command: string) => void;
  setShowSlashCommands: (show: boolean) => void;
  addToCliHistory: (item: { type: 'command' | 'output'; content: string; timestamp: Date }) => void;
  setCurrentWorkingDir: (dir: string) => void;
}

export class CommandHandler {
  private cliExecutor: CLIExecutor;
  private callbacks: CommandHandlerCallbacks;

  constructor(cliExecutor: CLIExecutor, callbacks: CommandHandlerCallbacks) {
    this.cliExecutor = cliExecutor;
    this.callbacks = callbacks;
  }

  /**
   * Get available slash commands based on current mode
   */
  getSlashCommands(currentMode: Mode): SlashCommand[] {
    const commands: SlashCommand[] = [
      {
        label: '/settings',
        value: '/settings',
        description: 'Open settings',
        action: () => this.callbacks.setMode('settings'),
      },
      {
        label: '/quit',
        value: '/quit',
        description: 'Exit application',
        action: () => process.exit(0),
      },
      {
        label: '/cwd',
        value: '/cwd ',
        description: 'Change working directory',
        action: () => this.callbacks.setCommand('/cwd '),
      },
    ];

    // Add mode-switching commands based on current mode
    if (currentMode !== 'command') {
      commands.push({
        label: '/cli',
        value: '/cli',
        description: 'Switch to CLI mode',
        action: () => this.callbacks.setMode('command'),
      });
    }

    if (currentMode !== 'chat') {
      commands.push({
        label: '/chat',
        value: '/chat',
        description: 'Switch to chat mode',
        action: () => this.callbacks.setMode('chat'),
      });
    }

    if (currentMode !== 'agent') {
      commands.push({
        label: '/agent',
        value: '/agent',
        description: 'Switch to agent mode',
        action: () => this.callbacks.setMode('agent'),
      });
    }

    if (currentMode !== 'search') {
      commands.push({
        label: '/search',
        value: '/search',
        description: 'Switch to search mode',
        action: () => this.callbacks.setMode('search'),
      });
    }

    return commands;
  }

  /**
   * Handle slash command execution
   */
  async handleSlashCommand(value: string, currentWorkingDir: string): Promise<boolean> {
    const parts = value.split(' ');
    const slashCommand = parts[0].toLowerCase();

    if (slashCommand === '/settings') {
      this.callbacks.setMode('settings');
      return true;
    } else if (slashCommand === '/quit') {
      process.exit(0);
    } else if (slashCommand === '/chat') {
      this.callbacks.setMode('chat');
      return true;
    } else if (slashCommand === '/cli') {
      this.callbacks.setMode('command');
      return true;
    } else if (slashCommand === '/agent') {
      this.callbacks.setMode('agent');
      return true;
    } else if (slashCommand === '/search') {
      this.callbacks.setMode('search');
      return true;
    } else if (slashCommand === '/cwd') {
      return this.handleCwdCommand(parts, currentWorkingDir);
    }

    return false;
  }

  /**
   * Handle change working directory command
   */
  private handleCwdCommand(parts: string[], currentWorkingDir: string): boolean {
    if (parts.length < 2) {
      this.callbacks.addToCliHistory({
        type: 'command',
        content: parts.join(' '),
        timestamp: new Date()
      });
      this.callbacks.addToCliHistory({
        type: 'output',
        content: 'Error: Missing folder argument. Usage: /cwd <folder>',
        timestamp: new Date()
      });
      return true;
    }

    const targetDir = parts.slice(1).join(' ');
    let resolvedPath = targetDir;

    // Handle relative paths
    if (!path.isAbsolute(targetDir)) {
      resolvedPath = path.resolve(currentWorkingDir, targetDir);
    }

    // Check if directory exists
    if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
      this.callbacks.addToCliHistory({
        type: 'command',
        content: parts.join(' '),
        timestamp: new Date()
      });
      this.callbacks.addToCliHistory({
        type: 'output',
        content: `Error: Directory not found: ${resolvedPath}`,
        timestamp: new Date()
      });
      return true;
    }

    // Update the working directory
    this.cliExecutor.setCurrentWorkingDir(resolvedPath);
    this.callbacks.setCurrentWorkingDir(resolvedPath);

    // Add to CLI history
    this.callbacks.addToCliHistory({
      type: 'command',
      content: parts.join(' '),
      timestamp: new Date()
    });
    this.callbacks.addToCliHistory({
      type: 'output',
      content: `Changed directory to: ${resolvedPath}`,
      timestamp: new Date()
    });

    return true;
  }

  /**
   * Handle slash command selection from autocomplete
   */
  handleSlashCommandSelect(item: { value: string }, commands: SlashCommand[]): void {
    const selectedCommand = commands.find(cmd => cmd.value === item.value);
    if (selectedCommand) {
      // For /cwd, keep the command in the input field
      if (selectedCommand.value === '/cwd ') {
        this.callbacks.setCommand('/cwd ');
        this.callbacks.setShowSlashCommands(false);
        return;
      }

      selectedCommand.action();
    }
    this.callbacks.setCommand('');
    this.callbacks.setShowSlashCommands(false);
  }

  /**
   * Check if input looks like a command rather than natural language
   */
  isLikelyCommand(input: string): boolean {
    const trimmed = input.trim();

    // Common command patterns
    const commandPatterns = [
      /^[a-zA-Z]+[\s\-\w]*$/,  // Basic command pattern like "ls", "git status", "npm install"
      /^[a-zA-Z]+\s+--?\w+/,   // Command with flags like "ls --help", "git -v"
      /^cd\s+/,                // cd commands
      /^\w+\.(exe|bat|cmd)/,   // Windows executables
    ];

    // If it doesn't contain question words or looks like a command, treat as command
    const questionWords = ['how', 'what', 'why', 'when', 'where', 'which', 'can', 'should', 'would', 'could'];
    const hasQuestionWords = questionWords.some(word =>
      trimmed.toLowerCase().includes(word.toLowerCase())
    );

    const looksLikeCommand = commandPatterns.some(pattern => pattern.test(trimmed));

    // If it looks like a command and doesn't have question words, treat as command
    return looksLikeCommand && !hasQuestionWords;
  }
}