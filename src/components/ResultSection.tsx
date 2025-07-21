import React from 'react';
import { Box, Text } from 'ink';
import SelectInput from 'ink-select-input';
import { Mode } from '../types/index';
import { SlashCommand } from '../services/commandHandler';
import { SearchResult } from '../services/searchService';
import { FileSystemItem } from '../hooks/useFileSystem';

interface CommandPage {
  command: string;
  description: string;
  options?: string;
  examples?: string;
}

interface ResultSectionProps {
  mode: Mode;
  // Slash commands
  showSlashCommands: boolean;
  filteredSlashCommands: SlashCommand[];
  onSlashCommandSelect: (item: { value: string }) => void;
  
  // Search results
  showSearchResults: boolean;
  searchResults: SearchResult[];
  selectedSearchIndex: number;
  commandHistoryCount: number;
  command: string;
  onSearchResultSelect: (item: SearchResult) => void;
  
  // Agent command pages
  showCommandPages: boolean;
  commandPages: CommandPage[];
  currentPageIndex: number;
  
  // File browser
  showFileBrowser: boolean;
  fileBrowserItems: FileSystemItem[];
  selectedFileIndex: number;
  currentBrowsingPath: string;
  onFileBrowserSelect: (item: { value: string }) => void;
}

const ResultSection: React.FC<ResultSectionProps> = ({
  mode,
  showSlashCommands,
  filteredSlashCommands,
  onSlashCommandSelect,
  showSearchResults,
  searchResults,
  selectedSearchIndex,
  commandHistoryCount,
  command,
  onSearchResultSelect,
  showCommandPages,
  commandPages,
  currentPageIndex,
  showFileBrowser,
  fileBrowserItems,
  selectedFileIndex,
  currentBrowsingPath,
  onFileBrowserSelect
}) => {
  return (
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
            onSelect={onSlashCommandSelect}
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
                onSelect={onSearchResultSelect}
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
            onSelect={onFileBrowserSelect}
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
  );
};

export default ResultSection;