import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';
import { SettingsConfig } from '../types/index';
import { modelsByProvider } from '../utils/models';
import { saveSettings } from '../utils/config';
import { cliDb } from '../utils/storage';
import Field from './Field';

interface SettingsProps {
  onExit: () => void;
  onSave: () => void;
  settings: SettingsConfig;
}

type Tab = 'general' | 'aliases';
type GeneralField = 'provider' | 'model' | 'apiKey' | 'save';
type AliasField = 'textEditor' | 'save';

const Settings = ({ onExit, onSave, settings: initialSettings }: SettingsProps) => {
  const [settings, setSettings] = useState<SettingsConfig>(initialSettings);
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [activeField, setActiveField] = useState<GeneralField>('provider');
  const [activeAliasField, setActiveAliasField] = useState<AliasField>('textEditor');
  
  // F-alias management state
  const [fAliases, setFAliases] = useState<any[]>([]);
  const [aliasText, setAliasText] = useState('');
  const [currentLine, setCurrentLine] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

  // Load f-aliases on component mount
  useEffect(() => {
    loadFAliases();
  }, []);

  const loadFAliases = () => {
    const aliases = cliDb.getFAliases();
    setFAliases(aliases);
    // Convert aliases to text format
    const textFormat = aliases.map(alias => 
      `${alias.alias}=${alias.path}${alias.description ? ` # ${alias.description}` : ''}`
    ).join('\n');
    setAliasText(textFormat);
    setCurrentLine(0);
    setCursorPosition(0);
  };

  const handleSaveAliases = () => {
    // Parse text format and save to database
    const lines = aliasText.split('\n').filter(line => line.trim());
    
    // Clear existing aliases
    const existingAliases = cliDb.getFAliases();
    existingAliases.forEach(alias => cliDb.deleteFAlias(alias.alias));
    
    // Parse and add new aliases
    lines.forEach(line => {
      const commentIndex = line.indexOf('#');
      const mainPart = commentIndex >= 0 ? line.substring(0, commentIndex).trim() : line.trim();
      const description = commentIndex >= 0 ? line.substring(commentIndex + 1).trim() : '';
      
      const [alias, path] = mainPart.split('=').map(part => part.trim());
      if (alias && path) {
        cliDb.addFAlias(alias, path, description);
      }
    });
    
    loadFAliases();
  };

  // Handle keyboard input for navigation
  useInput((input, key) => {
    // Exit settings with Ctrl+Left Arrow
    if (key.ctrl && key.leftArrow) {
      onExit();
      return;
    }

    console.log('Key pressed:', key);

    // Switch tabs with Ctrl+Up/Down
    if (key.ctrl && key.upArrow) {
      setActiveTab('general');
      // Prevent event propagation
      return;
    }
    if (key.ctrl && key.downArrow) {
      setActiveTab('aliases');
      // Prevent event propagation
      return;
    }

    if (activeTab === 'general') {
      // Tab navigation for general settings
      if (key.tab) {
        if (activeField === 'provider') setActiveField('model');
        else if (activeField === 'model') setActiveField('apiKey');
        else if (activeField === 'apiKey') setActiveField('save');
        else if (activeField === 'save') setActiveField('provider');
      }

      // Enter key on save button
      if (key.return && activeField === 'save') {
        handleSave();
      }
    } else if (activeTab === 'aliases') {
      // Handle text editor navigation
      if (activeAliasField === 'textEditor') {
        const lines = aliasText.split('\n');
        
        if (key.return) {
          // Add new line at cursor position
          const currentLineText = lines[currentLine] || '';
          const beforeCursor = currentLineText.substring(0, cursorPosition);
          const afterCursor = currentLineText.substring(cursorPosition);
          
          const newLines = [...lines];
          newLines[currentLine] = beforeCursor;
          newLines.splice(currentLine + 1, 0, afterCursor);
          
          setAliasText(newLines.join('\n'));
          setCurrentLine(prev => prev + 1);
          setCursorPosition(0);
          return;
        }
        
        if (key.upArrow && currentLine > 0) {
          setCurrentLine(prev => prev - 1);
          const prevLineLength = (lines[currentLine - 1] || '').length;
          setCursorPosition(Math.min(cursorPosition, prevLineLength));
          return;
        }
        
        if (key.downArrow && currentLine < lines.length - 1) {
          setCurrentLine(prev => prev + 1);
          const nextLineLength = (lines[currentLine + 1] || '').length;
          setCursorPosition(Math.min(cursorPosition, nextLineLength));
          return;
        }
        
        if (key.leftArrow) {
          if (cursorPosition > 0) {
            setCursorPosition(prev => prev - 1);
          } else if (currentLine > 0) {
            setCurrentLine(prev => prev - 1);
            setCursorPosition((lines[currentLine - 1] || '').length);
          }
          return;
        }
        
        if (key.rightArrow) {
          const currentLineText = lines[currentLine] || '';
          if (cursorPosition < currentLineText.length) {
            setCursorPosition(prev => prev + 1);
          } else if (currentLine < lines.length - 1) {
            setCurrentLine(prev => prev + 1);
            setCursorPosition(0);
          }
          return;
        }
        
        // Handle regular character input
        if (input && !key.ctrl && !key.meta) {
          const currentLineText = lines[currentLine] || '';
          const beforeCursor = currentLineText.substring(0, cursorPosition);
          const afterCursor = currentLineText.substring(cursorPosition);
          
          const newLines = [...lines];
          newLines[currentLine] = beforeCursor + input + afterCursor;
          
          setAliasText(newLines.join('\n'));
          setCursorPosition(prev => prev + input.length);
          return;
        }
        
        // Handle backspace
        if (key.backspace) {
          if (cursorPosition > 0) {
            const currentLineText = lines[currentLine] || '';
            const beforeCursor = currentLineText.substring(0, cursorPosition - 1);
            const afterCursor = currentLineText.substring(cursorPosition);
            
            const newLines = [...lines];
            newLines[currentLine] = beforeCursor + afterCursor;
            
            setAliasText(newLines.join('\n'));
            setCursorPosition(prev => prev - 1);
          } else if (currentLine > 0) {
            // Join with previous line
            const prevLineLength = (lines[currentLine - 1] || '').length;
            const currentLineText = lines[currentLine] || '';
            
            const newLines = [...lines];
            newLines[currentLine - 1] = (newLines[currentLine - 1] || '') + currentLineText;
            newLines.splice(currentLine, 1);
            
            setAliasText(newLines.join('\n'));
            setCurrentLine(prev => prev - 1);
            setCursorPosition(prevLineLength);
          }
          return;
        }
      }
      
      // Tab navigation for alias settings
      if (key.tab) {
        if (activeAliasField === 'textEditor') setActiveAliasField('save');
        else if (activeAliasField === 'save') setActiveAliasField('textEditor');
      }

      // Enter key on save button
      if (key.return && activeAliasField === 'save') {
        handleSaveAliases();
      }
    }
  });

  const handleSave = () => {
    saveSettings(settings);
    onSave();
  };

  const providerItems = ['Anthropic', 'OpenAI', 'Google'].map(provider => ({
    label: provider,
    value: provider,
  }));

  const modelItems = modelsByProvider[settings.provider] || [];

  const renderGeneralTab = () => (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Field label="Provider" isActive={activeField === 'provider'}>
          <SelectInput
            items={providerItems}
            initialIndex={providerItems.findIndex(item => item.value === settings.provider)}
            onSelect={item => {
              setSettings(prev => ({
                ...prev,
                provider: item.value,
                model: modelsByProvider[item.value]?.[0]?.value || '',
              }));
            }}
          />
        </Field>
      </Box>

      <Box marginBottom={1}>
        <Field label="Model" isActive={activeField === 'model'}>
          <SelectInput
            items={modelItems}
            initialIndex={modelItems.findIndex(item => item.value === settings.model)}
            onSelect={item => {
              setSettings(prev => ({ ...prev, model: item.value }));
            }}
          />
        </Field>
      </Box>

      <Box marginBottom={1}>
        <Field label="API Key" isActive={activeField === 'apiKey'}>
          <TextInput
            value={settings.apiKey}
            onChange={value => {
              setSettings(prev => ({ ...prev, apiKey: value }));
            }}
            mask="*"
            showCursor={activeField === 'apiKey'}
          />
        </Field>
      </Box>

      <Box
        borderStyle={activeField === 'save' ? 'round' : undefined}
        borderColor="green"
        paddingX={2}
        paddingY={0}
        marginLeft={15}
      >
        <Text color="green" bold={activeField === 'save'}>
          Save
        </Text>
      </Box>
    </Box>
  );

  const renderAliasTab = () => {
    const lines = aliasText.split('\n');
    if (lines.length === 0) lines.push('');
    
    const maxDisplayLines = 10;
    const startLine = Math.max(0, Math.min(currentLine - 5, lines.length - maxDisplayLines));
    const displayLines = lines.slice(startLine, startLine + maxDisplayLines);
    
    return (
      <Box flexDirection="column">
        <Box marginBottom={1}>
          <Text bold>F-Alias Editor</Text>
        </Box>
        <Box marginBottom={1}>
          <Text color="gray">Format: alias=path # description</Text>
        </Box>
        
        <Box marginBottom={2}>
          <Field label="Aliases" isActive={activeAliasField === 'textEditor'}>
            <Box
              borderStyle={activeAliasField === 'textEditor' ? 'round' : 'single'}
              borderColor={activeAliasField === 'textEditor' ? 'cyan' : 'gray'}
              paddingX={1}
              height={12}
              width={80}
              flexDirection="column"
            >
              {displayLines.length > 0 ? (
                displayLines.map((line, index) => {
                  const actualLineIndex = startLine + index;
                  const isCurrentLine = actualLineIndex === currentLine && activeAliasField === 'textEditor';
                  
                  if (isCurrentLine) {
                    // Show cursor on current line
                    const beforeCursor = line.substring(0, cursorPosition) || '';
                    const afterCursor = line.substring(cursorPosition) || '';
                    const cursorChar = afterCursor.charAt(0) || ' ';
                    const remainingText = afterCursor.substring(1) || '';
                    
                    return (
                      <Box key={actualLineIndex} flexDirection="row">
                        <Text color="cyan">{`${actualLineIndex + 1}: `}</Text>
                        <Text>{beforeCursor}</Text>
                        <Text backgroundColor="cyan" color="black">{cursorChar}</Text>
                        <Text>{remainingText}</Text>
                      </Box>
                    );
                  } else {
                    return (
                      <Box key={actualLineIndex} flexDirection="row">
                        <Text color="gray">{`${actualLineIndex + 1}: `}</Text>
                        <Text>{line || ' '}</Text>
                      </Box>
                    );
                  }
                })
              ) : (
                <Text color="gray">userdir=/home/user # User home directory</Text>
              )}
              {startLine > 0 && (
                <Text color="gray">↑ {startLine} more lines above</Text>
              )}
              {startLine + maxDisplayLines < lines.length && (
                <Text color="gray">↓ {lines.length - startLine - maxDisplayLines} more lines below</Text>
              )}
            </Box>
          </Field>
        </Box>

        <Box
          borderStyle={activeAliasField === 'save' ? 'round' : undefined}
          borderColor="green"
          paddingX={2}
          paddingY={0}
          marginLeft={15}
        >
          <Text color="green" bold={activeAliasField === 'save'}>
            Save Aliases
          </Text>
        </Box>
        
        <Box marginTop={2}>
          <Text color="gray">
          {activeAliasField === 'textEditor' 
            ? "Use arrows to navigate, Enter for new line, Tab to save"
            : "Tab: navigate fields | Enter: save aliases"
          }
          </Text>
        </Box>
      </Box>
    );
  };

  return (
    <Box flexDirection="row">
      {/* Vertical Tab sidebar */}
      <Box flexDirection="column" width={20} marginRight={2} borderStyle="single" borderColor="gray" paddingX={1}>
        <Box marginBottom={1}>
          <Text bold>Settings</Text>
        </Box>
        
        <Box 
          borderStyle={activeTab === 'general' ? 'round' : undefined}
          borderColor={activeTab === 'general' ? 'cyan' : undefined}
          paddingX={1}
          marginBottom={1}
        >
          <Text 
            color={activeTab === 'general' ? 'cyan' : 'white'}
            bold={activeTab === 'general'}
          >
            LLM Settings
          </Text>
        </Box>
        
        <Box 
          borderStyle={activeTab === 'aliases' ? 'round' : undefined}
          borderColor={activeTab === 'aliases' ? 'cyan' : undefined}
          paddingX={1}
          marginBottom={1}
        >
          <Text 
            color={activeTab === 'aliases' ? 'cyan' : 'white'}
            bold={activeTab === 'aliases'}
          >
            F-Aliases
          </Text>
        </Box>
        
        <Box marginTop={2}>
          <Text color="gray">
          Ctrl+↑↓: tabs
          Ctrl+←: exit
          Tab: fields
          </Text>
        </Box>
      </Box>

      {/* Tab content */}
      <Box flexGrow={1}>
        {activeTab === 'general' ? renderGeneralTab() : renderAliasTab()}
      </Box>
    </Box>
  );
};

export default Settings;
