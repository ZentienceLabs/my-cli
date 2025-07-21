import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import BigText from 'ink-big-text';
import { Mode, SettingsConfig } from '../types/index';
import { loadSettings } from '../utils/config';
import { cliDb } from '../utils/storage';
import Settings from './Settings';
import CLISession from './CLISession';
import ChatSession from './ChatSession';
import AgentSession from './AgentSession';
import StatusBar from './StatusBar';
import InputSection from './InputSection';
import ResultSection from './ResultSection';
import CommandNotification from './CommandNotification';
import { CLIExecutor, type CLIHistoryItem } from '../services/cliExecutor';
import type { ChatHistoryItem } from './ChatSession';
import type { AgentHistoryItem } from './AgentSession';

// Custom hooks and services
import { useAgent } from '../hooks/useAgent';
import { useSearch } from '../hooks/useSearch';
import { useFileSystem } from '../hooks/useFileSystem';
import { CommandHandler, type SlashCommand } from '../services/commandHandler';

interface CLIProps {
  initialSettings: SettingsConfig;
}

interface CommandPage {
  command: string;
  description: string;
  options?: string;
  examples?: string;
}

const CLI = ({ initialSettings }: CLIProps) => {
  // Core state
  const [settings, setSettings] = useState<SettingsConfig>(initialSettings);
  const [mode, setMode] = useState<Mode>('command');
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentWorkingDir, setCurrentWorkingDir] = useState<string>(process.cwd());

  // History states
  const [chatHistory, setChatHistory] = useState<ChatHistoryItem[]>([]);
  const [agentHistory, setAgentHistory] = useState<AgentHistoryItem[]>([]);
  const [cliHistory, setCLIHistory] = useState<CLIHistoryItem[]>([]);

  // UI states
  const [showSlashCommands, setShowSlashCommands] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<string>('');
  const [commandSource, setCommandSource] = useState<'search' | 'agent' | ''>('');

  // Agent command pages
  const [commandPages, setCommandPages] = useState<CommandPage[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [showCommandPages, setShowCommandPages] = useState(false);

  // Custom hooks
  const agent = useAgent(initialSettings);
  const search = useSearch();
  const fileSystem = useFileSystem();

  // Services
  const [cliExecutor] = useState(() => CLIExecutor.getInstance());
  const [commandHandler] = useState(() => new CommandHandler(cliExecutor, {
    setMode,
    setCommand,
    setShowSlashCommands,
    addToCliHistory: (item) => cliExecutor.addToHistory(item),
    setCurrentWorkingDir
  }));

  // Initialize CLI executor subscription
  useEffect(() => {
    const unsubscribe = cliExecutor.subscribe((history: CLIHistoryItem[]) => {
      setCLIHistory(history);
      setCurrentWorkingDir(cliExecutor.getCurrentWorkingDir());
    });

    // Initialize default f-aliases
    cliDb.initializeDefaultFAliases();

    // Clear API key from memory after initialization
    const timerId = setTimeout(() => {
      setSettings(prev => ({ ...prev, apiKey: '' }));
    }, 1000);

    return () => {
      unsubscribe();
      clearTimeout(timerId);
    };
  }, [cliExecutor]);

  // Clear states when mode changes
  useEffect(() => {
    if (mode === 'search') {
      search.setSearchResults([]);
      search.setShowSearchResults(false);
    }
    if (mode !== 'agent') {
      setCommandPages([]);
      setShowCommandPages(false);
      setCurrentPageIndex(0);
    }
  }, [mode]); // Remove search from dependencies

  // Reinitialize agent when settings change
  const reinitializeAgent = () => {
    const updatedSettings = loadSettings();
    setSettings(updatedSettings);
    agent.reinitialize();
    setMode('command');
  };

  // Parse LLM response for command information
  const parseCommandResponse = (response: string): string => {
    const commandBlocks = response.match(/\[COMMAND_RESPONSE\](.*?)\[\/COMMAND_RESPONSE\]/gs);
    if (!commandBlocks) {
      setShowCommandPages(false);
      setCommandPages([]);
      return response;
    }

    const commands = commandBlocks.map(block => {
      const content = block.replace(/\[COMMAND_RESPONSE\]|\[\/COMMAND_RESPONSE\]/g, '').trim();
      const lines = content.split('\n').map(line => line.trim()).filter(line => line);

      const commandInfo: CommandPage = {
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

    return response.replace(/\[COMMAND_RESPONSE\](.*?)\[\/COMMAND_RESPONSE\]/gs, '').trim();
  };

  // Handle @ trigger for file browsing
  const handleAtTrigger = (input: string): void => {
    const atIndex = input.lastIndexOf('@');
    if (atIndex === -1) return;

    const beforeAt = input.substring(0, atIndex);
    const afterAt = input.substring(atIndex + 1);

    // Check for custom f-aliases first
    if (beforeAt && afterAt === '') {
      const alias = cliDb.getFAlias(beforeAt);
      if (alias) {
        try {
          fileSystem.scanDirectory(alias.path);
          return;
        } catch (error) {
          console.error(`F-alias "${beforeAt}" points to invalid path:`, alias.path);
          fileSystem.setFileBrowserItems([]);
          fileSystem.setShowFileBrowser(false);
          return;
        }
      }
    }

    // Check for drive-specific browsing (c@, d@, etc.)
    if (beforeAt.length === 1 && /^[a-zA-Z]$/.test(beforeAt)) {
      const driveLetter = beforeAt.toUpperCase();
      const drivePath = `${driveLetter}:\\`;
      try {
        fileSystem.scanDirectory(drivePath);
      } catch (error) {
        fileSystem.setFileBrowserItems([]);
        fileSystem.setShowFileBrowser(false);
      }
    } else if (beforeAt === '' && afterAt === '') {
      // Just @ - show current directory
      fileSystem.scanDirectory(currentWorkingDir);
    }
  };

  // Handle input change
  const handleInputChange = (value: string): void => {
    setCommand(value);

    // Clear selected command state if user starts typing
    if (selectedCommand && value !== selectedCommand) {
      setSelectedCommand('');
      setCommandSource('');
    }

    // Check for @ trigger for file browsing
    if (value.includes('@')) {
      handleAtTrigger(value);
      setShowSlashCommands(false);
      search.setShowSearchResults(false);
      return;
    } else {
      fileSystem.setShowFileBrowser(false);
      fileSystem.setFileBrowserItems([]);
    }

    // Check if it's a slash command
    if (value.startsWith('/') && !value.includes(' ')) {
      const commands = commandHandler.getSlashCommands(mode);
      const filteredCommands = commands.filter(cmd => cmd.value.startsWith(value));

      if (filteredCommands.length > 0) {
        setShowSlashCommands(true);
      } else {
        setShowSlashCommands(false);
      }

      search.setShowSearchResults(false);
    } else {
      setShowSlashCommands(false);

      // If in search mode, search command history
      if (mode === 'search') {
        search.searchCommandHistory(value);
      } else {
        search.setShowSearchResults(false);
      }
    }
  };

  // Handle search result selection
  const handleSearchResultSelect = (item: { label: string; value: string }): void => {
    setCommand(item.value);
    setSelectedCommand(item.value);
    setCommandSource('search');
    search.setShowSearchResults(false);
    search.setSearchResults([]);
  };

  // Handle command submission
  const handleSubmit = async (value: string): Promise<void> => {
    if (!value.trim()) return;

    // Handle slash commands
    if (value.startsWith('/')) {
      const handled = await commandHandler.handleSlashCommand(value, currentWorkingDir);
      if (handled) {
        setCommand('');
        setShowSlashCommands(false);
        return;
      }
      setCommand('');
      return;
    }

    // Handle search mode
    if (mode === 'search' && !search.showSearchResults) {
      setMode('command');
      setCommand('');
      cliExecutor.executeCommand(value).then(() => {
        search.updateCommandCount();
      });
      return;
    }

    if (mode === 'search' && search.showSearchResults) {
      return;
    }

    // Handle agent mode - execute command if selected from command pages
    if (mode === 'agent' && commandSource === 'agent' && commandHandler.isLikelyCommand(value)) {
      setMode('command');
      setCommand('');
      cliExecutor.executeCommand(value).then(() => {
        search.updateCommandCount();
      });
      return;
    }

    // Add to appropriate history
    if (mode === 'chat') {
      setChatHistory(prev => [...prev, { type: 'question', content: value, timestamp: new Date() }]);
    } else if (mode === 'agent') {
      setAgentHistory(prev => [...prev, { type: 'question', content: value, timestamp: new Date() }]);
    }

    setCommand('');
    setSelectedCommand('');
    setCommandSource('');

    if (mode === 'command') {
      cliExecutor.executeCommand(value).then(() => {
        search.updateCommandCount();
      });
    } else if (mode === 'chat') {
      await handleChatRequest(value);
    } else if (mode === 'agent') {
      await handleAgentRequest(value);
    }
  };

  // Handle chat request
  const handleChatRequest = async (value: string): Promise<void> => {
    if (!agent.isAvailable) {
      setChatHistory(prev => [...prev, { 
        type: 'answer', 
        content: 'Error: No LangGraph agent configured. Please check settings.', 
        timestamp: new Date() 
      }]);
      return;
    }

    setIsProcessing(true);
    setChatHistory(prev => [...prev, { type: 'answer', content: 'Thinking...', timestamp: new Date() }]);

    try {
      const chatHistoryContext = chatHistory.map(msg => ({
        role: msg.type === 'question' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const responseText = await agent.processRequest(value, 'chat', chatHistoryContext);

      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { type: 'answer', content: responseText, timestamp: new Date() };
        return newHistory;
      });

      cliDb.addConversation('chat', value, responseText);
    } catch (error: any) {
      const errorMsg = `Error: ${(error as Error).message || 'Failed to get response from agent'}`;
      console.error(errorMsg);

      setChatHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { type: 'answer', content: errorMsg, timestamp: new Date() };
        return newHistory;
      });

      cliDb.addConversation('chat', value, errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle agent request
  const handleAgentRequest = async (value: string): Promise<void> => {
    if (!agent.isAvailable) {
      setAgentHistory(prev => [...prev, { 
        type: 'answer', 
        content: 'Error: No LangGraph agent configured. Please check settings.', 
        timestamp: new Date() 
      }]);
      return;
    }

    setIsProcessing(true);
    setAgentHistory(prev => [...prev, { type: 'answer', content: 'Thinking...', timestamp: new Date() }]);

    try {
      const agentHistoryContext = agentHistory.map(msg => ({
        role: msg.type === 'question' ? 'user' as const : 'assistant' as const,
        content: msg.content
      }));

      const responseText = await agent.processRequest(value, 'agent', agentHistoryContext);
      const cleanResponse = parseCommandResponse(responseText);

      setAgentHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { type: 'answer', content: cleanResponse || responseText, timestamp: new Date() };
        return newHistory;
      });

      cliDb.addConversation('agent', value, cleanResponse || responseText);
    } catch (error: any) {
      const errorMsg = `Error: ${(error as Error).message || 'Failed to get response from agent'}`;
      console.error(errorMsg);

      setAgentHistory(prev => {
        const newHistory = [...prev];
        newHistory[newHistory.length - 1] = { type: 'answer', content: errorMsg, timestamp: new Date() };
        return newHistory;
      });

      cliDb.addConversation('agent', value, errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // Keyboard shortcuts
  useInput((input, key) => {
    // File browser navigation
    if (fileSystem.showFileBrowser && fileSystem.fileBrowserItems.length > 0) {
      if (key.upArrow && !key.ctrl) {
        fileSystem.setSelectedFileIndex(prev => 
          prev === 0 ? fileSystem.fileBrowserItems.length - 1 : prev - 1
        );
        return;
      } else if (key.downArrow && !key.ctrl) {
        fileSystem.setSelectedFileIndex(prev => (prev + 1) % fileSystem.fileBrowserItems.length);
        return;
      } else if (key.return) {
        const selectedItem = fileSystem.fileBrowserItems[fileSystem.selectedFileIndex];
        if (selectedItem) {
          if (selectedItem.isDirectory) {
            fileSystem.scanDirectory(selectedItem.value);
          } else {
            const atIndex = command.lastIndexOf('@');
            const beforeAt = command.substring(0, atIndex);
            setCommand(beforeAt + selectedItem.value);
            fileSystem.setShowFileBrowser(false);
            fileSystem.setFileBrowserItems([]);
          }
        }
        return;
      } else if (input === ' ') {
        const atIndex = command.lastIndexOf('@');
        const beforeAt = command.substring(0, atIndex);
        const selectedItem = fileSystem.fileBrowserItems[fileSystem.selectedFileIndex];
        if (selectedItem) {
          setCommand(beforeAt + selectedItem.value + ' ');
        } else if (fileSystem.currentBrowsingPath) {
          setCommand(beforeAt + fileSystem.currentBrowsingPath + ' ');
        }
        fileSystem.setShowFileBrowser(false);
        fileSystem.setFileBrowserItems([]);
        return;
      }
    }

    // Search results navigation
    if (mode === 'search' && search.showSearchResults && search.searchResults.length > 0) {
      if (key.upArrow && !key.ctrl) {
        search.setSelectedSearchIndex(prev => 
          prev === 0 ? search.searchResults.length - 1 : prev - 1
        );
        return;
      } else if (key.downArrow && !key.ctrl) {
        search.setSelectedSearchIndex(prev => (prev + 1) % search.searchResults.length);
        return;
      } else if (key.escape) {
        search.setShowSearchResults(false);
        search.setSearchResults([]);
        setCommand('');
        setSelectedCommand('');
        setCommandSource('');
        return;
      } else if (key.delete) {
        const selectedCommandItem = search.searchResults[search.selectedSearchIndex];
        if (selectedCommandItem) {
          const deleted = search.deleteCommand(selectedCommandItem.value);
          if (deleted) {
            const newIndex = search.selectedSearchIndex >= search.searchResults.length - 1 ? 0 : search.selectedSearchIndex;
            search.setSelectedSearchIndex(newIndex);
            
            if (command.trim() === '**') {
              search.searchCommandHistory('**');
            } else {
              search.searchCommandHistory(command);
            }
          }
        }
        return;
      }
    }

    // Agent command pages navigation
    if (key.ctrl && (key.leftArrow || key.rightArrow) && mode === 'agent' && showCommandPages && commandPages.length > 0) {
      if (key.leftArrow) {
        setCurrentPageIndex(prev => prev === 0 ? commandPages.length - 1 : prev - 1);
      } else if (key.rightArrow) {
        setCurrentPageIndex(prev => (prev + 1) % commandPages.length);
      }
      return;
    }

    // Enter key in agent mode with command pages
    if (key.return && mode === 'agent' && showCommandPages && commandPages.length > 0) {
      const selectedCommandInfo = commandPages[currentPageIndex];
      if (selectedCommandInfo && selectedCommandInfo.command) {
        setCommand(selectedCommandInfo.command);
        setSelectedCommand(selectedCommandInfo.command);
        setCommandSource('agent');
        setShowCommandPages(false);
        setCommandPages([]);
      }
      return;
    }

    // Escape key in agent mode
    if (key.escape && mode === 'agent' && showCommandPages) {
      setShowCommandPages(false);
      setCommandPages([]);
      setCommand('');
      setSelectedCommand('');
      setCommandSource('');
      return;
    }

    // Mode switching with Ctrl+Up/Down - don't trigger in settings mode
    if (key.ctrl && (key.upArrow || key.downArrow) && mode !== 'settings') {
      const modes: Mode[] = ['command', 'chat', 'agent', 'search'];
      const currentIndex = modes.indexOf(mode);

      let nextIndex;
      if (key.upArrow) {
        nextIndex = (currentIndex + 1) % modes.length;
      } else {
        nextIndex = currentIndex === 0 ? modes.length - 1 : currentIndex - 1;
      }

      setMode(modes[nextIndex]);
    }
  });

  if (mode === 'settings') {
    return <Settings 
      onExit={() => setMode('command')} 
      onSave={reinitializeAgent} 
      settings={settings}
    />;
  }

  const slashCommands = commandHandler.getSlashCommands(mode);
  const filteredSlashCommands = slashCommands.filter(cmd => 
    cmd.value.startsWith(command.toLowerCase())
  );

  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Status Bar */}
      <StatusBar currentWorkingDir={currentWorkingDir} />
      
      {/* Title */}
      <Box justifyContent="center" alignItems="center" marginY={1}>
        <BigText text="my-cli" colors={['blue', 'cyan', 'magenta', 'red']} />
      </Box>
      
      {/* Session Content */}
      {mode === 'command' ? (
        <CLISession 
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
        <CLISession 
          history={cliHistory} 
          currentWorkingDir={currentWorkingDir}
        />
      ) : (
        <Box flexGrow={1} flexDirection="column" flexShrink={0} flexBasis="75%" overflowY="visible">
          <Box paddingX={1}>
            <Text>Select a mode to begin</Text>
          </Box>
        </Box>
      )}

      {/* Input Section */}
      <InputSection
        mode={mode}
        command={command}
        selectedCommand={selectedCommand}
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
      />
      
      {/* Results Section */}
      <ResultSection
        mode={mode}
        showSlashCommands={showSlashCommands}
        filteredSlashCommands={filteredSlashCommands}
        onSlashCommandSelect={(item) => commandHandler.handleSlashCommandSelect(item, slashCommands)}
        showSearchResults={search.showSearchResults}
        searchResults={search.searchResults}
        selectedSearchIndex={search.selectedSearchIndex}
        commandHistoryCount={search.commandHistoryCount}
        command={command}
        onSearchResultSelect={handleSearchResultSelect}
        showCommandPages={showCommandPages}
        commandPages={commandPages}
        currentPageIndex={currentPageIndex}
        showFileBrowser={fileSystem.showFileBrowser}
        fileBrowserItems={fileSystem.fileBrowserItems}
        selectedFileIndex={fileSystem.selectedFileIndex}
        currentBrowsingPath={fileSystem.currentBrowsingPath}
        onFileBrowserSelect={(item) => {
          const selectedItem = fileSystem.fileBrowserItems.find(f => f.value === item.value);
          if (selectedItem) {
            if (selectedItem.isDirectory) {
              fileSystem.scanDirectory(selectedItem.value);
            } else {
              const atIndex = command.lastIndexOf('@');
              const beforeAt = command.substring(0, atIndex);
              setCommand(beforeAt + selectedItem.value);
              fileSystem.setShowFileBrowser(false);
              fileSystem.setFileBrowserItems([]);
            }
          }
        }}
      />
      
      {/* Command Selection Notification */}
      <CommandNotification
        selectedCommand={selectedCommand}
        commandSource={commandSource}
      />
    </Box>
  );
};

export default CLI;