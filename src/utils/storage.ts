import fs from 'fs';
import path from 'path';
import homedir from 'os-homedir';
import Database from 'better-sqlite3';

// Define the home directory for the CLI
const CLI_HOME_DIR = path.join(homedir(), '.my-cli');
const SETTINGS_FILE = path.join(CLI_HOME_DIR, 'settings.json');
const DB_FILE = path.join(CLI_HOME_DIR, 'data', 'my-cli.db');

/**
 * Ensures that the CLI home directory structure exists
 */
export function ensureHomeDirectory(): void {
  // Create main directory
  if (!fs.existsSync(CLI_HOME_DIR)) {
    fs.mkdirSync(CLI_HOME_DIR, { recursive: true });
  }
  
  // Create data directory
  const dataDir = path.join(CLI_HOME_DIR, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // Create default settings file if it doesn't exist
  if (!fs.existsSync(SETTINGS_FILE)) {
    const defaultSettings = {
      provider: 'Anthropic',
      model: 'claude-3-opus-20240229',
      apiKey: '',
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(defaultSettings, null, 2));
  }
}

/**
 * Loads settings from the settings file
 */
export function loadSettings(): any {
  ensureHomeDirectory();
  try {
    const settingsContent = fs.readFileSync(SETTINGS_FILE, 'utf-8');
    return JSON.parse(settingsContent);
  } catch (error) {
    console.error('Error loading settings:', error);
    return {
      provider: 'Anthropic',
      model: 'claude-3-opus-20240229',
      apiKey: '',
    };
  }
}

/**
 * Saves settings to the settings file
 */
export function saveSettings(settings: any): void {
  ensureHomeDirectory();
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Error saving settings:', error);
  }
}

/**
 * SQLite database class for persistent storage
 */
export class CliDatabase {
  private db: Database.Database;
  
  constructor() {
    ensureHomeDirectory();
    this.db = new Database(DB_FILE);
    this.initializeTables();
  }
  
  /**
   * Initialize database tables
   */
  private initializeTables(): void {
    // Create history table to store command history
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL,
        input TEXT NOT NULL,
        output TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create conversations table for chat/agent interactions
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mode TEXT NOT NULL,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create cmd_history table for CLI command execution tracking
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cmd_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        command TEXT NOT NULL UNIQUE,
        last_time_used DATETIME DEFAULT CURRENT_TIMESTAMP,
        no_of_time_executed INTEGER DEFAULT 1
      )
    `);
    
    // Create f_aliases table for custom file/folder shortcuts
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS f_aliases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        alias TEXT NOT NULL UNIQUE,
        path TEXT NOT NULL,
        description TEXT,
        type TEXT DEFAULT 'auto',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  /**
   * Add a command to history
   */
  addToHistory(mode: string, input: string, output: string): void {
    const stmt = this.db.prepare('INSERT INTO history (mode, input, output) VALUES (?, ?, ?)');
    stmt.run(mode, input, output);
  }
  
  /**
   * Get command history
   */
  getHistory(limit = 50): any[] {
    const stmt = this.db.prepare('SELECT * FROM history ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit);
  }
  
  /**
   * Add a conversation entry
   */
  addConversation(mode: string, userMessage: string, aiResponse: string): void {
    const stmt = this.db.prepare(
      'INSERT INTO conversations (mode, user_message, ai_response) VALUES (?, ?, ?)'
    );
    stmt.run(mode, userMessage, aiResponse);
  }
  
  /**
   * Add or update a command in the cmd_history table
   * @param command The command that was executed
   */
  addCommandToHistory(command: string): void {
    // Check if the command already exists in the history
    const existingCmd = this.db.prepare(`
      SELECT command, no_of_time_executed FROM cmd_history
      WHERE command = ?
    `).get(command);
    
    if (existingCmd) {
      // Update the existing command record
      const stmt = this.db.prepare(`
        UPDATE cmd_history
        SET last_time_used = CURRENT_TIMESTAMP,
            no_of_time_executed = no_of_time_executed + 1
        WHERE command = ?
      `);
      stmt.run(command);
    } else {
      // Insert a new command record
      const stmt = this.db.prepare(`
        INSERT INTO cmd_history (command)
        VALUES (?)
      `);
      stmt.run(command);
    }
  }
  
  /**
   * Get conversation history
   */
  getConversations(limit = 50): any[] {
    const stmt = this.db.prepare('SELECT * FROM conversations ORDER BY timestamp DESC LIMIT ?');
    return stmt.all(limit);
  }
  
  /**
   * Get command history with usage statistics
   * @param limit Maximum number of commands to return
   * @param sortBy Field to sort by ('last_time_used' or 'no_of_time_executed')
   * @returns Array of command history entries
   */
  getCommandHistory(limit = 50, sortBy = 'last_time_used'): any[] {
    // Validate sort field to prevent SQL injection
    const validSortFields = ['last_time_used', 'no_of_time_executed', 'command'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'last_time_used';
    
    const stmt = this.db.prepare(`
      SELECT command, last_time_used, no_of_time_executed 
      FROM cmd_history
      ORDER BY ${sortField} DESC
      LIMIT ?
    `);
    
    return stmt.all(limit);
  }
  
  /**
   * Get total count of commands in cmd_history table
   * @returns Total number of commands in history
   */
  getCommandHistoryCount(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM cmd_history');
    const result = stmt.get() as { count: number };
    return result.count;
  }
  
  /**
   * Delete a command from cmd_history table
   * @param command The command to delete
   * @returns True if command was deleted, false if not found
   */
  deleteCommandFromHistory(command: string): boolean {
    const stmt = this.db.prepare('DELETE FROM cmd_history WHERE command = ?');
    const result = stmt.run(command);
    return result.changes > 0;
  }
  
  /**
   * Search command history for commands matching a search term
   * @param searchTerm The term to search for in command history
   * @param limit Maximum number of results to return
   * @returns Array of matching command history entries
   */
  searchCommandHistory(searchTerm: string, limit = 20): any[] {
    // If search term is empty, return most recent commands
    if (!searchTerm.trim()) {
      return this.getCommandHistory(limit);
    }
    
    // Use LIKE query with wildcards to find partial matches
    const stmt = this.db.prepare(`
      SELECT command, last_time_used, no_of_time_executed 
      FROM cmd_history
      WHERE command LIKE ?
      ORDER BY no_of_time_executed DESC, last_time_used DESC
      LIMIT ?
    `);
    
    return stmt.all(`%${searchTerm}%`, limit);
  }
  
  /**
   * Add or update an f-alias
   * @param alias The alias name (without @)
   * @param path The full path the alias points to
   * @param description Optional description for the alias
   * @param type Type of alias ('auto', 'file', 'folder')
   * @returns True if successful, false if failed
   */
  addFAlias(alias: string, path: string, description?: string, type: string = 'auto'): boolean {
    try {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO f_aliases (alias, path, description, type)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(alias, path, description || '', type);
      return true;
    } catch (error) {
      console.error('Error adding f-alias:', error);
      return false;
    }
  }
  
  /**
   * Get all f-aliases
   * @returns Array of f-alias objects
   */
  getFAliases(): any[] {
    const stmt = this.db.prepare('SELECT * FROM f_aliases ORDER BY alias');
    return stmt.all();
  }
  
  /**
   * Get f-alias by name
   * @param alias The alias name to look up
   * @returns The alias object or null if not found
   */
  getFAlias(alias: string): any {
    const stmt = this.db.prepare('SELECT * FROM f_aliases WHERE alias = ?');
    return stmt.get(alias);
  }
  
  /**
   * Delete an f-alias
   * @param alias The alias name to delete
   * @returns True if deleted, false if not found
   */
  deleteFAlias(alias: string): boolean {
    const stmt = this.db.prepare('DELETE FROM f_aliases WHERE alias = ?');
    const result = stmt.run(alias);
    return result.changes > 0;
  }
  
  /**
   * Initialize default f-aliases
   */
  initializeDefaultFAliases(): void {
    const homeDir = homedir();
    const defaults = [
      { alias: 'userdir', path: homeDir, description: 'User home directory', type: 'folder' },
      { alias: 'desktop', path: path.join(homeDir, 'Desktop'), description: 'Desktop folder', type: 'folder' },
      { alias: 'documents', path: path.join(homeDir, 'Documents'), description: 'Documents folder', type: 'folder' },
      { alias: 'downloads', path: path.join(homeDir, 'Downloads'), description: 'Downloads folder', type: 'folder' },
    ];
    
    defaults.forEach(({ alias, path: aliasPath, description, type }) => {
      // Only add if it doesn't already exist
      if (!this.getFAlias(alias)) {
        this.addFAlias(alias, aliasPath, description, type);
      }
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}

// Export a singleton instance
export const cliDb = new CliDatabase();
