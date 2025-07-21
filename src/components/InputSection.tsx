import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Mode } from '../types/index';

interface InputSectionProps {
  mode: Mode;
  command: string;
  selectedCommand: string;
  onInputChange: (value: string) => void;
  onSubmit: (value: string) => void;
}

const InputSection: React.FC<InputSectionProps> = ({
  mode,
  command,
  selectedCommand,
  onInputChange,
  onSubmit
}) => {
  // Set prompt based on current mode
  let prompt = '[CLI]> ';
  if (mode === 'chat') prompt = '[CHAT]> ';
  if (mode === 'agent') prompt = '[AGENT]> ';
  if (mode === 'search') prompt = '[SEARCH]> ';

  // Dynamic placeholder text
  let placeholderText = "Type your message or / for commands";
  if (selectedCommand) {
    placeholderText = `Command selected - Press Enter to execute or Esc to cancel`;
  }

  return (
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
        onChange={onInputChange}
        onSubmit={onSubmit}
        placeholder={placeholderText}
      />
    </Box>
  );
};

export default InputSection;