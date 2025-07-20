import { spawn } from 'child_process';
import { cliDb } from '../utils/storage.js';

export interface CliHistoryItem {
  type: 'command' | 'output';
  content: string;
  timestamp: Date;
}

export class CliExecutor {
  private static instance: CliExecutor;
  private history: CliHistoryItem[] = [];
  private currentWorkingDir: string = process.cwd();
  private isProcessing: boolean = false;
  private subscribers: Array<(history: CliHistoryItem[], isProcessing: boolean) => void> = [];

  private constructor() {}

  public static getInstance(): CliExecutor {
    if (!CliExecutor.instance) {
      CliExecutor.instance = new CliExecutor();
    }
    return CliExecutor.instance;
  }

  public subscribe(callback: (history: CliHistoryItem[], isProcessing: boolean) => void) {
    this.subscribers.push(callback);
    // Immediately call with current state
    callback(this.history, this.isProcessing);
    
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach(callback => callback(this.history, this.isProcessing));
  }

  public getHistory(): CliHistoryItem[] {
    return [...this.history];
  }

  public getCurrentWorkingDir(): string {
    return this.currentWorkingDir;
  }

  public setCurrentWorkingDir(dir: string): void {
    this.currentWorkingDir = dir;
  }

  public isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }

  public addToHistory(item: CliHistoryItem) {
    this.history.push(item);
    this.notifySubscribers();
  }

  public executeCommand(command: string): Promise<void> {
    return new Promise((resolve) => {
      // Add command to history
      this.addToHistory({
        type: 'command',
        content: command,
        timestamp: new Date()
      });

      this.isProcessing = true;
      this.notifySubscribers();

      const childProcess = spawn(command, { shell: true, cwd: this.currentWorkingDir });
      let output = '';

      childProcess.stdout.on('data', (data) => {
        const dataStr = data.toString();
        output += dataStr;
        
        // Add output to history immediately
        this.addToHistory({
          type: 'output',
          content: dataStr.trimEnd(),
          timestamp: new Date()
        });
      });

      childProcess.stderr.on('data', (data) => {
        const dataStr = data.toString();
        output += dataStr;
        
        // Add error output to history immediately
        this.addToHistory({
          type: 'output',
          content: dataStr.trimEnd(),
          timestamp: new Date()
        });
      });

      childProcess.on('close', (code) => {
        if (output === '') {
          const resultMsg = `Command executed with exit code ${code}`;
          this.addToHistory({
            type: 'output',
            content: resultMsg,
            timestamp: new Date()
          });
          output = resultMsg;
        }
        
        // Store command in SQLite database
        cliDb.addToHistory('command', command, output);
        
        // Store command in cmd_history table for tracking usage
        cliDb.addCommandToHistory(command);
        
        this.isProcessing = false;
        this.notifySubscribers();
        resolve();
      });

      childProcess.on('error', (error) => {
        const errorMsg = `Error executing command: ${error.message}`;
        this.addToHistory({
          type: 'output',
          content: errorMsg,
          timestamp: new Date()
        });
        
        this.isProcessing = false;
        this.notifySubscribers();
        resolve();
      });
    });
  }

  public clearHistory() {
    this.history = [];
    this.notifySubscribers();
  }
}