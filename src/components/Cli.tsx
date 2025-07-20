import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import SelectInput from 'ink-select-input';
import BigText from 'ink-big-text';
import { spawn } from 'child_process';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import fs from 'fs';
import { createLangGraphAgent } from '../utils/langGraphAgent.js';
import { Mode, SettingsConfig } from '../types/index.js';
import { loadSettings, saveSettings } from '../utils/config.js';
import { cliDb } from '../utils/storage.js';
import Settings from './Settings.js';
import CliSession from './CliSession.js';
import ChatSession from './ChatSession.js';
import AgentSession from './AgentSession.js';
import { CliExecutor, type CliHistoryItem } from '../services/cliExecutor.js';
import type { ChatHistoryItem } from './ChatSession.js';
import type { AgentHistoryItem } from './AgentSession.js';

interface CliProps {
  initialSettings: SettingsConfig;
}

interface SlashCommand {
  label: string;
  value: string;
  description: string;
  action: () => void;
}

const Cli = ({ initialSettings }: CliProps) => {
  const [settings, setSettings] = useState<SettingsConfig>(initialSettings);
  const [mode, setMode] = useState<Mode>('command');  // 'command', 'chat', 'agent', 'search', or 'settings'
  const [command, setCommand] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]); // Persistent chat session history
  const [agentHistory, setAgentHistory] = useState<AgentHistoryItem[]>([]); // Persistent agent session history
  const [cliHistory, setCliHistory] = useState<CliHistoryItem[]>([]); // CLI session history
  const [client, setClient] = useState<Anthropic | null>(null);
  const [langGraphAgent, setLangGraphAgent] = useState<((input: string) => Promise<string>) | null>(null);
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cliExecutor] = useState(() => CliExecutor.getInstance());
  const [currentWorkingDir, setCurrentWorkingDir] = useState<string>(process.cwd());
  const [searchResults, setSearchResults] = useState<{label: string; value: string}[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [commandHistoryCount, setCommandHistoryCount] = useState(0);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [commandPages, setCommandPages] = useState<{command: string; description: string; options?: string; examples?: string}[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showCommandPages, setShowCommandPages] = useState(false);
  const [fileBrowserItems, setFileBrowserItems] = useState<{label: string; value: string; isDirectory: boolean}[]>([]);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [currentBrowsingPath, setCurrentBrowsingPath] = useState<string>('');
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const [commandSource, setCommandSource] = useState<'search' | 'agent' | ''>('');

  // Initialize Anthropic client and LangGraph agent
  const initializeClient = () => {
    if (settings.provider === 'Anthropic' && settings.apiKey) {
      // Initialize LangGraph agent
      setLangGraphAgent(createLangGraphAgent(settings.apiKey, settings.model));
      
      // Return Anthropic client for chat mode
      return new Anthropic({ apiKey: settings.apiKey });
    } else {
      // Clear langGraphAgent if no valid settings
      setLangGraphAgent(null);
    }
    return null;
  };

  const reinitializeClient = () => {
    const updatedSettings = loadSettings();
    setSettings(updatedSettings);
    
    // Initialize with updated settings
    if (updatedSettings.provider === 'Anthropic' && updatedSettings.apiKey) {
      setLangGraphAgent(createLangGraphAgent(updatedSettings.apiKey, updatedSettings.model));
      setClient(new Anthropic({ apiKey: updatedSettings.apiKey }));
    } else {
      setLangGraphAgent(null);
      setClient(null);
    }
    
    setMode('command');
  };

  useEffect(() => {
    const client = initializeClient();
    setClient(client);
    // Load command history count
    setCommandHistoryCount(cliDb.getCommandHistoryCount());
    // Initialize default f-aliases
    cliDb.initializeDefaultFAliases();
    
    // Subscribe to CLI executor updates
    const unsubscribe = cliExecutor.subscribe((history, processing) => {
      setCliHistory(history);
      // Update current working directory from executor
      setCurrentWorkingDir(cliExecutor.getCurrentWorkingDir());
    });
    
    return unsubscribe;
  }, [cliExecutor]);

  // Re-initialize when settings change
  useEffect(() => {
    if (settings.provider === 'Anthropic' && settings.apiKey && settings.apiKey !== 'your_api_key_here') {
      setLangGraphAgent(createLangGraphAgent(settings.apiKey, settings.model));
      setClient(new Anthropic({ apiKey: settings.apiKey }));
    } else {
      setLangGraphAgent(null);
      setClient(null);
    }
  }, [settings]);

  // Clear mode-specific state when switching modes
  useEffect(() => {
    if (mode === 'search') {
      setSearchResults([]);
      setShowSearchResults(false);
    }
    if (mode !== 'agent') {
      setCommandPages([]);
      setShowCommandPages(false);
      setCurrentPageIndex(0);
    }
  }, [mode]);

  // Handle keyboard shortcuts
  useInput((input, key) => {
    // File browser navigation
    if (showFileBrowser && fileBrowserItems.length > 0) {
      if (key.upArrow && !key.ctrl) {
        setSelectedFileIndex(prev => prev === 0 ? fileBrowserItems.length - 1 : prev - 1);
        return;
      } else if (key.downArrow && !key.ctrl) {
        setSelectedFileIndex(prev => (prev + 1) % fileBrowserItems.length);
        return;
      } else if (key.return) {
        // Enter key - select file/folder
        const selectedItem = fileBrowserItems[selectedFileIndex];
        if (selectedItem) {
          if (selectedItem.isDirectory) {
            // If it's a directory, browse into it
            scanDirectory(selectedItem.value);
          } else {
            // If it's a file, add its path to the command
            const atIndex = command.lastIndexOf('@');
            const beforeAt = command.substring(0, atIndex);
            setCommand(beforeAt + selectedItem.value);
            setShowFileBrowser(false);
            setFileBrowserItems([]);
          }
        }
        return;
      } else if (input === ' ') {
        // Space key - terminate browsing and add current path to command
        const atIndex = command.lastIndexOf('@');
        const beforeAt = command.substring(0, atIndex);
        const selectedItem = fileBrowserItems[selectedFileIndex];
        if (selectedItem) {
          setCommand(beforeAt + selectedItem.value + ' ');
        } else if (currentBrowsingPath) {
          setCommand(beforeAt + currentBrowsingPath + ' ');
        }
        setShowFileBrowser(false);
        setFileBrowserItems([]);
        return;
      }
    }
    
    // Track arrow key navigation in search results to know selected index
    if (mode === 'search' && showSearchResults && searchResults.length > 0) {
      if (key.upArrow && !key.ctrl) {
        setSelectedSearchIndex(prev => prev === 0 ? searchResults.length - 1 : prev - 1);
        return;
      } else if (key.downArrow && !key.ctrl) {
        setSelectedSearchIndex(prev => (prev + 1) % searchResults.length);
        return;
      } else if (key.escape) {
        // Esc key cancels command selection in search mode
        setShowSearchResults(false);
        setSearchResults([]);
        setCommand('');
        setSelectedCommand('');
        setCommandSource('');
        return;
      } else if (key.delete) {
        // Delete key in search mode with results showing
        const selectedCommand = searchResults[selectedSearchIndex];
        if (selectedCommand) {
          // Delete the command from database
          const deleted = cliDb.deleteCommandFromHistory(selectedCommand.value);
          if (deleted) {
            // Adjust selected index if needed
            const newIndex = selectedSearchIndex >= searchResults.length - 1 ? 0 : selectedSearchIndex;
            setSelectedSearchIndex(newIndex);
            
            // Refresh search results
            if (command.trim() === '**') {
              searchCommandHistory('**');
            } else {
              searchCommandHistory(command);
            }
            // Update command count
            setCommandHistoryCount(cliDb.getCommandHistoryCount());
          }
        }
        return;
      }
    }
    
    // Page navigation in agent mode with Ctrl+Left/Right arrows
    if (key.ctrl && (key.leftArrow || key.rightArrow) && mode === 'agent' && showCommandPages && commandPages.length > 0) {
      if (key.leftArrow) {
        // Navigate to previous page
        setCurrentPageIndex(prev => prev === 0 ? commandPages.length - 1 : prev - 1);
      } else if (key.rightArrow) {
        // Navigate to next page
        setCurrentPageIndex(prev => (prev + 1) % commandPages.length);
      }
      return;
    }
    
    // Enter key in agent mode with command pages: select command to input
    if (key.return && mode === 'agent' && showCommandPages && commandPages.length > 0) {
      const selectedCommandInfo = commandPages[currentPageIndex];
      if (selectedCommandInfo && selectedCommandInfo.command) {
        // Copy command to input field and mark as selected
        setCommand(selectedCommandInfo.command);
        setSelectedCommand(selectedCommandInfo.command);
        setCommandSource('agent');
        // Hide command pages to allow next Enter to execute
        setShowCommandPages(false);
        setCommandPages([]);
      }
      return;
    }
    
    // Esc key in agent mode cancels command selection
    if (key.escape && mode === 'agent' && showCommandPages) {
      setShowCommandPages(false);
      setCommandPages([]);
      setCommand('');
      setSelectedCommand('');
      setCommandSource('');
      return;
    }
    
    // Mode switching with Ctrl+Up/Down Arrow
    if (key.ctrl && (key.upArrow || key.downArrow)) {
      const modes: Mode[] = ['command', 'chat', 'agent', 'search'];
      const currentIndex = modes.indexOf(mode);
      
      let nextIndex;
      if (key.upArrow) {
        // Cycle forward through modes
        nextIndex = (currentIndex + 1) % modes.length;
      } else {
        // Cycle backward through modes
        nextIndex = currentIndex === 0 ? modes.length - 1 : currentIndex - 1;
      }
      
      setMode(modes[nextIndex]);
    }
  });


  // Handle input change
  const handleInputChange = (value: string) => {
    // First update the command state
    setCommand(value);
    
    // Clear selected command state if user starts typing
    if (selectedCommand && value !== selectedCommand) {
      setSelectedCommand('');
      setCommandSource('');
    }
    
    // Check for @ trigger for file browsing
    if (value.includes('@')) {
      handleAtTrigger(value);
      // Hide other UI elements when file browser is active
      setShowSlashCommands(false);
      setShowSearchResults(false);
      return;
    } else {
      // Hide file browser when @ is not present
      setShowFileBrowser(false);
      setFileBrowserItems([]);
    }
    
    // Check if it's a slash command
    if (value.startsWith('/') && !value.includes(' ')) {
      const commands = getSlashCommands();
      const filteredCommands = commands.filter(cmd => cmd.value.startsWith(value));
      
      if (filteredCommands.length > 0) {
        setShowSlashCommands(true);
      } else {
        setShowSlashCommands(false);
      }
      
      // Don't show search results when typing slash commands
      setShowSearchResults(false);
    } else {
      setShowSlashCommands(false);
      
      // If in search mode, search command history
      if (mode === 'search') {
        searchCommandHistory(value);
      } else {
        setShowSearchResults(false);
      }
    }
  };

  // Search command history
  const searchCommandHistory = (searchTerm: string) => {
    let results;
    
    // Check if user typed ** to show all commands
    if (searchTerm.trim() === '**') {
      // Get all command history directly
      results = cliDb.getCommandHistory(100);
      console.log('Getting all commands:', results); // Debug log
    } else if (searchTerm.trim() === '') {
      // For empty search, don't show any results
      results = [];
    } else {
      results = cliDb.searchCommandHistory(searchTerm);
    }
    
    // Always format results, even if empty array
    const formattedResults = results.map(item => ({
      label: `${item.command} (${item.no_of_time_executed}×)`,
      value: item.command
    }));
    
    setSearchResults(formattedResults);
    setShowSearchResults(formattedResults.length > 0);
    // Reset selected index when results change
    setSelectedSearchIndex(0);
  };
  
  // Parse LLM response for command information
  const parseCommandResponse = (response: string) => {
    const commandBlocks = response.match(/\[COMMAND_RESPONSE\](.*?)\[\/COMMAND_RESPONSE\]/gs);
    if (!commandBlocks) {
      setShowCommandPages(false);
      setCommandPages([]);
      return response;
    }

    const commands = commandBlocks.map(block => {
      const content = block.replace(/\[COMMAND_RESPONSE\]|\[\/COMMAND_RESPONSE\]/g, '').trim();
      const lines = content.split('\n').map(line => line.trim()).filter(line => line);
      
      const commandInfo: {command: string; description: string; options?: string; examples?: string} = {
        command: '',
        description: ''
      };

      lines.forEach(line => {
        if (line.startsWith('COMMAND:')) {
          commandInfo.command = line.replace('COMMAND:', '').trim();
        } else if (line.startsWith('DESCRIPTION:')) {
          commandInfo.description = line.replace('DESCRIPTION:', '').trim();
        } else if (line.startsWith('OPTIONS:')) {
          commandInfo.options = line.replace('OPTIONS:', '').trim();
        } else if (line.startsWith('EXAMPLES:')) {
          commandInfo.examples = line.replace('EXAMPLES:', '').trim();
        }
      });

      return commandInfo;
    });

    setCommandPages(commands.filter(cmd => cmd.command && cmd.description));
    setCurrentPageIndex(0);
    setShowCommandPages(commands.length > 0);

    // Return the original response with command blocks removed for display
    return response.replace(/\[COMMAND_RESPONSE\](.*?)\[\/COMMAND_RESPONSE\]/gs, '').trim();
  };

  // Scan directory for files and folders
  const scanDirectory = (dirPath: string) => {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      const formattedItems = items
        .map(item => ({
          label: item.isDirectory() ? `📁 ${item.name}/` : `📄 ${item.name}`,
          value: path.join(dirPath, item.name),
          isDirectory: item.isDirectory()
        }))
        .sort((a, b) => {
          // Directories first, then files, both alphabetically
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.label.localeCompare(b.label);
        });
      
      setFileBrowserItems(formattedItems);
      setSelectedFileIndex(0);
      setShowFileBrowser(formattedItems.length > 0);
      setCurrentBrowsingPath(dirPath);
    } catch (error) {
      console.error('Error scanning directory:', error);
      setFileBrowserItems([]);
      setShowFileBrowser(false);
    }
  };

  // Get drive roots (Windows-specific)
  const getDriveRoots = () => {
    const drives = [];
    // Common Windows drives
    for (let drive = 'A'.charCodeAt(0); drive <= 'Z'.charCodeAt(0); drive++) {
      const driveLetter = String.fromCharCode(drive);
      const drivePath = `${driveLetter}:\\`;
      try {
        fs.accessSync(drivePath);
        drives.push({
          label: `💽 ${driveLetter}: Drive`,
          value: drivePath,
          isDirectory: true
        });
      } catch (error) {
        // Drive doesn't exist, skip
      }
    }
    return drives;
  };

  // Handle @ trigger for file browsing
  const handleAtTrigger = (input: string) => {
    const atIndex = input.lastIndexOf('@');
    if (atIndex === -1) return;

    const beforeAt = input.substring(0, atIndex);
    const afterAt = input.substring(atIndex + 1);

    // Check for custom f-aliases first
    if (beforeAt && afterAt === '') {
      const alias = cliDb.getFAlias(beforeAt);
      if (alias) {
        try {
          fs.accessSync(alias.path);
          scanDirectory(alias.path);
          return;
        } catch (error) {
          console.error(`F-alias "${beforeAt}" points to invalid path:`, alias.path);
          setFileBrowserItems([]);
          setShowFileBrowser(false);
          return;
        }
      }
    }

    // Check for drive-specific browsing (c@, d@, etc.)
    if (beforeAt.length === 1 && /^[a-zA-Z]$/.test(beforeAt)) {
      const driveLetter = beforeAt.toUpperCase();
      const drivePath = `${driveLetter}:\\`;
      try {
        fs.accessSync(drivePath);
        scanDirectory(drivePath);
      } catch (error) {
        setFileBrowserItems([]);
        setShowFileBrowser(false);
      }
    } else if (beforeAt === '' && afterAt === '') {
      // Just @ - show current directory
      scanDirectory(currentWorkingDir);
    }
  };

  // Check if input looks like a command (rather than a natural language query)
  const isLikelyCommand = (input: string): boolean => {
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
  };

  // Handle search result selection
  const handleSearchResultSelect = (item: {label: string; value: string}) => {
    // Set command value and mark as selected - TextInput should automatically position cursor at end
    setCommand(item.value);
    setSelectedCommand(item.value);
    setCommandSource('search');
    setShowSearchResults(false);
    // Clear search results after selection to allow next Enter to execute
    setSearchResults([]);
  };

  // Handle command submission
  const handleSubmit = async (value: string) => {
    if (!value.trim()) return;

    // Handle slash commands
    if (value.startsWith('/')) {
      const parts = value.split(' ');
      const slashCommand = parts[0].toLowerCase();
      
      if (slashCommand === '/settings') {
        setMode('settings');
        setCommand('');
        return;
      } else if (slashCommand === '/quit') {
        process.exit(0);
      } else if (slashCommand === '/chat') {
        setMode('chat');
        setCommand('');
        return;
      } else if (slashCommand === '/cli') {
        setMode('command');
        setCommand('');
        return;
      } else if (slashCommand === '/agent') {
        setMode('agent');
        setCommand('');
        return;
      } else if (slashCommand === '/search') {
        setMode('search');
        setCommand('');
        return;
      } else if (slashCommand === '/cwd') {
        // Handle change working directory command
        if (parts.length < 2) {
          // Add to CLI history since /cwd is a CLI command
          cliExecutor.addToHistory({
            type: 'command',
            content: value,
            timestamp: new Date()
          });
          cliExecutor.addToHistory({
            type: 'output',
            content: 'Error: Missing folder argument. Usage: /cwd <folder>',
            timestamp: new Date()
          });
          setCommand('');
          setShowSlashCommands(false);
          return;
        }
        
        const targetDir = parts.slice(1).join(' ');
        let resolvedPath = targetDir;
        
        // Handle relative paths
        if (!path.isAbsolute(targetDir)) {
          resolvedPath = path.resolve(currentWorkingDir, targetDir);
        }
        
        // Check if directory exists
        if (!fs.existsSync(resolvedPath) || !fs.statSync(resolvedPath).isDirectory()) {
          // Add to CLI history since /cwd is a CLI command
          cliExecutor.addToHistory({
            type: 'command',
            content: value,
            timestamp: new Date()
          });
          cliExecutor.addToHistory({
            type: 'output',
            content: `Error: Directory not found: ${resolvedPath}`,
            timestamp: new Date()
          });
          setCommand('');
          setShowSlashCommands(false);
          return;
        }
        
        // Update the working directory in CLI executor
        cliExecutor.setCurrentWorkingDir(resolvedPath);
        setCurrentWorkingDir(resolvedPath);
        
        // Add to CLI history
        cliExecutor.addToHistory({
          type: 'command',
          content: value,
          timestamp: new Date()
        });
        cliExecutor.addToHistory({
          type: 'output',
          content: `Changed directory to: ${resolvedPath}`,
          timestamp: new Date()
        });
        
        setCommand('');
        setShowSlashCommands(false);
        return;
      }
      
      setCommand('');
      return;
    }

    // Handle search mode - execute command in CLI mode only if no search results are shown
    if (mode === 'search' && !showSearchResults) {
      setMode('command');
      setCommand('');
      
      // Execute command using shared CLI executor
      cliExecutor.executeCommand(value).then(() => {
        // Update command history count after execution
        setCommandHistoryCount(cliDb.getCommandHistoryCount());
      });
      return;
    }
    
    // If in search mode with results showing, just ignore the submit (SelectInput handles it)
    if (mode === 'search' && showSearchResults) {
      return;
    }
    
    // Handle agent mode - execute command in CLI mode only if this looks like a command
    // (we only want to execute when user selected a command from pages, not regular queries)
    if (mode === 'agent' && !showCommandPages && isLikelyCommand(value)) {
      setMode('command');
      setCommand('');
      
      // Execute command using shared CLI executor
      cliExecutor.executeCommand(value).then(() => {
        // Update command history count after execution
        setCommandHistoryCount(cliDb.getCommandHistoryCount());
      });
      return;
    }

    // Add the command to history with appropriate label
    if (mode === 'chat') {
      setChatHistory(prev => [...prev, { type: 'question', content: value, timestamp: new Date() }]);
    } else if (mode === 'agent') {
      setAgentHistory(prev => [...prev, { type: 'question', content: value, timestamp: new Date() }]);
    }
    
    setCommand('');
    // Clear selected command state after execution
    setSelectedCommand('');
    setCommandSource('');

    if (mode === 'command') {
      // Execute command using shared CLI executor
      cliExecutor.executeCommand(value).then(() => {
        // Update command history count after execution
        setCommandHistoryCount(cliDb.getCommandHistoryCount());
      });
    } else if (mode === 'chat') {
      // Process with LLM directly
      if (!client) {
        setChatHistory(prev => [...prev, { type: 'answer', content: 'Error: No API client configured. Please check settings.', timestamp: new Date() }]);
        return;
      }

      // Show loading indicator
      setIsProcessing(true);
      setChatHistory(prev => [...prev, { type: 'answer', content: 'Thinking...', timestamp: new Date() }]);

      try {
        const response = await client.messages.create({
          model: settings.model,
          max_tokens: 1000,
          messages: [
            { role: 'user', content: value }
          ],
        });

        // Handle different response formats safely
        let responseText = '';
        if (response.content && response.content[0]) {
          if (typeof response.content[0] === 'string') {
            responseText = response.content[0];
          } else if (response.content[0].type === 'text' && response.content[0].text) {
            responseText = response.content[0].text;
          } else {
            responseText = JSON.stringify(response.content[0]);
          }
        }
        
        // Replace the loading indicator with the actual response
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { type: 'answer', content: responseText, timestamp: new Date() };
          return newHistory;
        });
        
        // Store conversation in SQLite database
        cliDb.addConversation('chat', value, responseText);
      } catch (error) {
        // Replace the loading indicator with the error message
        const errorMsg = `Error: ${(error as Error).message}`;
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { type: 'answer', content: errorMsg, timestamp: new Date() };
          return newHistory;
        });
        
        // Store error in database
        cliDb.addConversation('chat', value, errorMsg);
      } finally {
        setIsProcessing(false);
      }
    } else if (mode === 'agent') {
      // Process with Anthropic client (same as chat but with enhanced prompt)
      if (!client) {
        setAgentHistory(prev => [...prev, { type: 'answer', content: 'Error: No API client configured. Please check settings.', timestamp: new Date() }]);
        return;
      }

      // Show loading indicator
      setIsProcessing(true);
      setAgentHistory(prev => [...prev, { type: 'answer', content: 'Thinking...', timestamp: new Date() }]);

      try {
        // Create enhanced prompt for agent mode
        const agentPrompt = `You are a specialized AI assistant focused ONLY on command-line operations and technical commands.

I can help with:
- Operating system commands (Linux, Windows, macOS)
- Development tools (git, npm, docker, kubernetes, etc.)
- Terminal operations and shell scripting
- Command syntax, options, and usage examples
- Tool-specific commands and configurations

For command-related questions, respond with structured information in this format:
[COMMAND_RESPONSE]
COMMAND: command_name
DESCRIPTION: Brief description of what the command does
OPTIONS: Key command-line options and flags (if applicable)
EXAMPLES: Practical usage examples (if applicable)
[/COMMAND_RESPONSE]

You can include multiple command blocks if the query involves multiple commands.

IMPORTANT: If the user asks about non-command topics (general conversation, explanations of concepts not related to commands, personal questions, etc.), politely redirect them by saying:
"I'm specialized in command-line operations only. For general conversations and other topics, please switch to chat mode using Ctrl+C and selecting chat mode."

USER REQUEST: ${value}`;

        const response = await client.messages.create({
          model: settings.model,
          max_tokens: 1000,
          messages: [
            { role: 'user', content: agentPrompt }
          ],
        });

        // Handle different response formats safely
        let responseText = '';
        if (response.content && response.content[0]) {
          if (typeof response.content[0] === 'string') {
            responseText = response.content[0];
          } else if (response.content[0].type === 'text' && response.content[0].text) {
            responseText = response.content[0].text;
          } else {
            responseText = JSON.stringify(response.content[0]);
          }
        }

        // Parse response for command information
        const cleanResponse = parseCommandResponse(responseText);

        // Replace the loading indicator with the actual response
        setAgentHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { type: 'answer', content: cleanResponse || responseText, timestamp: new Date() };
          return newHistory;
        });
        
        // Store agent conversation in SQLite database
        cliDb.addConversation('agent', value, cleanResponse || responseText);
      } catch (error) {
        // Replace the loading indicator with the error message
        const errorMsg = `Error: ${(error as Error).message}`;
        setAgentHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { type: 'answer', content: errorMsg, timestamp: new Date() };
          return newHistory;
        });
        
        // Store error in database
        cliDb.addConversation('agent', value, errorMsg);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  // Define slash commands based on current mode
  const getSlashCommands = (): SlashCommand[] => {
    const commands: SlashCommand[] = [
      {
        label: '/settings',
        value: '/settings',
        description: 'Open settings',
        action: () => setMode('settings'),
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
        action: () => setCommand('/cwd '),
      },
    ];

    // Add mode-switching commands based on current mode
    if (mode !== 'command') {
      commands.push({
        label: '/cli',
        value: '/cli',
        description: 'Switch to CLI mode',
        action: () => setMode('command'),
      });
    }
    
    if (mode !== 'chat') {
      commands.push({
        label: '/chat',
        value: '/chat',
        description: 'Switch to chat mode',
        action: () => setMode('chat'),
      });
    }
    
    if (mode !== 'agent') {
      commands.push({
        label: '/agent',
        value: '/agent',
        description: 'Switch to agent mode',
        action: () => setMode('agent'),
      });
    }
    
    if (mode !== 'search') {
      commands.push({
        label: '/search',
        value: '/search',
        description: 'Switch to search mode',
        action: () => setMode('search'),
      });
    }

    return commands;
  };

  const slashCommands = getSlashCommands();
  const filteredSlashCommands = slashCommands.filter(cmd => 
    cmd.value.startsWith(command.toLowerCase())
  );

  const handleSlashCommandSelect = (item: { value: string }) => {
    const selectedCommand = slashCommands.find(cmd => cmd.value === item.value);
    if (selectedCommand) {
      // For /cwd, we need to keep the command in the input field to allow the user to specify a directory
      if (selectedCommand.value === '/cwd ') {
        setCommand('/cwd ');
        setShowSlashCommands(false);
        return;
      }
      
      selectedCommand.action();
    }
    setCommand('');
    setShowSlashCommands(false);
  };

  // Set prompt based on current mode
  let prompt = '[CLI]> ';
  if (mode === 'chat') prompt = '[CHAT]> ';
  if (mode === 'agent') prompt = '[AGENT]> ';
  if (mode === 'search') prompt = '[SEARCH]> ';
  
  // Dynamic placeholder text
  let placeholderText = "Type your message or / for commands";
  if (selectedCommand && commandSource) {
    placeholderText = `Command selected from ${commandSource.toUpperCase()} - Press Enter to execute or Esc to cancel`;
  }

  if (mode === 'settings') {
    return <Settings 
      onExit={() => setMode('command')} 
      onSave={reinitializeClient} 
      settings={settings}
    />;
  }

  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* SECTION 1: Top Info Bar - Shows current working directory */}
      <Box 
        borderStyle="single" 
        borderColor="gray" 
        paddingX={1}
        paddingY={0}
        marginBottom={1}
        width="100%"
      >
        <Text bold>CWD: </Text>
        <Text color="green">{currentWorkingDir}</Text>
      </Box>
      
      {/* SECTION 2: Work Section - Main content area with title and history */}
      {/* Title with Big Text */}
      <Box justifyContent="center" alignItems="center" marginY={1}>
        <BigText text="my-cli" colors={['blue', 'cyan', 'magenta', 'red']} />
      </Box>
      
      {/* Session History - Takes up space until 75% of screen height */}
      {mode === 'command' ? (
        <CliSession 
          history={cliHistory} 
          currentWorkingDir={currentWorkingDir}
        />
      ) : mode === 'chat' ? (
        <ChatSession 
          history={chatHistory}
          isProcessing={isProcessing}
        />
      ) : mode === 'agent' ? (
        <AgentSession 
          history={agentHistory}
          isProcessing={isProcessing}
        />
      ) : mode === 'search' ? (
        <CliSession 
          history={cliHistory} 
          currentWorkingDir={currentWorkingDir}
        />
      ) : (
        <Box flexGrow={1} flexDirection="column" flexShrink={0} flexBasis="75%" overflowY="visible">
          <Text>Select a mode to begin</Text>
        </Box>
      )}

      {/* SECTION 3: Input Section - Command input area */}
      <Box 
        borderStyle="round" 
        borderColor={selectedCommand ? "yellow" : "blue"}
        paddingX={1} 
        marginY={0}
        flexShrink={0}
        width="100%"
      >
        <Text color="magenta">{prompt}</Text>
        <TextInput
          value={command}
          onChange={handleInputChange}
          onSubmit={handleSubmit}
          placeholder={placeholderText}
        />
      </Box>
      
      {/* SECTION 4: Result Section - Options area for "list style results" (slash commands and search results) */}
      {/* "List style results" are navigable lists where users can use arrow keys to select and Enter to choose */}
      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        height={8}
        marginTop={0}
        flexShrink={0}
      >
        {showSlashCommands && filteredSlashCommands.length > 0 ? (
          <>
            <SelectInput
              items={filteredSlashCommands}
              onSelect={handleSlashCommandSelect}
            />
            <Box justifyContent="flex-end" paddingX={1}>
              <Text color="gray">1/{filteredSlashCommands.length}</Text>
            </Box>
          </>
        ) : mode === 'search' ? (
          <Box flexDirection="column" paddingX={1}>
            <Box justifyContent="space-between" marginBottom={1}>
              <Text bold color="green">Command History Search</Text>
              <Text color="gray">Total: {commandHistoryCount} commands</Text>
            </Box>
            {showSearchResults && searchResults.length > 0 ? (
              <>
                <SelectInput
                  items={searchResults}
                  onSelect={handleSearchResultSelect}
                  initialIndex={selectedSearchIndex}
                />
                <Box justifyContent="center" marginTop={1}>
                  <Text color="gray">Enter: select command → Enter again: execute | Esc: cancel | Del: remove</Text>
                </Box>
              </>
            ) : command.trim().length > 0 ? (
              <Text color="yellow">No matching commands found</Text>
            ) : (
              <Box flexDirection="column">
                <Text color="gray">Start typing to search command history...</Text>
                <Text color="gray">Type ** to show all commands</Text>
                <Text color="gray">Enter selects command, Enter again executes in CLI</Text>
                <Text color="gray">Delete key removes command from history</Text>
              </Box>
            )}
          </Box>
        ) : mode === 'agent' && showCommandPages && commandPages.length > 0 ? (
          <Box flexDirection="column" paddingX={1}>
            <Box justifyContent="space-between" marginBottom={1}>
              <Text bold color="cyan">Command Information</Text>
              <Text color="gray">Page {currentPageIndex + 1} of {commandPages.length}</Text>
            </Box>
            <Box flexDirection="column">
              <Text bold color="yellow">Command: {commandPages[currentPageIndex].command}</Text>
              <Text color="white" wrap="wrap">{commandPages[currentPageIndex].description}</Text>
              {commandPages[currentPageIndex].options && (
                <Box marginTop={1}>
                  <Text bold color="green">Options:</Text>
                  <Text color="white" wrap="wrap">{commandPages[currentPageIndex].options}</Text>
                </Box>
              )}
              {commandPages[currentPageIndex].examples && (
                <Box marginTop={1}>
                  <Text bold color="blue">Examples:</Text>
                  <Text color="white" wrap="wrap">{commandPages[currentPageIndex].examples}</Text>
                </Box>
              )}
            </Box>
            <Box justifyContent="center" marginTop={1}>
              <Text color="gray">Ctrl+Left/Right: navigate pages | Enter: select command → Enter again: execute | Esc: cancel</Text>
            </Box>
          </Box>
        ) : showFileBrowser && fileBrowserItems.length > 0 ? (
          <Box flexDirection="column" paddingX={1}>
            <Box justifyContent="space-between" marginBottom={1}>
              <Text bold color="magenta">File Browser</Text>
              <Text color="gray">{currentBrowsingPath || 'Drives'}</Text>
            </Box>
            <SelectInput
              items={fileBrowserItems}
              onSelect={(item) => {
                const selectedItem = fileBrowserItems.find(f => f.value === item.value);
                if (selectedItem) {
                  if (selectedItem.isDirectory) {
                    scanDirectory(selectedItem.value);
                  } else {
                    const atIndex = command.lastIndexOf('@');
                    const beforeAt = command.substring(0, atIndex);
                    setCommand(beforeAt + selectedItem.value);
                    setShowFileBrowser(false);
                    setFileBrowserItems([]);
                  }
                }
              }}
              initialIndex={selectedFileIndex}
            />
            <Box justifyContent="center" marginTop={1}>
              <Text color="gray">↑↓: navigate | Enter: select/open | Space: terminate browsing</Text>
            </Box>
          </Box>
        ) : (
          <Box paddingX={1}>
            <Text color="gray">Type / for commands, @ to browse files, or use f-aliases like userdir@</Text>
          </Box>
        )}
      </Box>
      
      {/* Command Selection Notification - positioned at bottom */}
      {selectedCommand && commandSource && (
        <Box 
          borderStyle="single" 
          borderColor="yellow" 
          paddingX={1}
          marginTop={1}
          flexShrink={0}
          width="100%"
        >
          <Text color="yellow" bold>⚡ COMMAND SELECTED </Text>
          <Text color="gray">from {commandSource.toUpperCase()}: </Text>
          <Text color="white" bold>{selectedCommand}</Text>
          <Text color="gray"> → Press </Text>
          <Text color="green" bold>Enter</Text>
          <Text color="gray"> to execute or </Text>
          <Text color="red" bold>Esc</Text>
          <Text color="gray"> to cancel</Text>
        </Box>
      )}
    </Box>
  );
};

export default Cli;
