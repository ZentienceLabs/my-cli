import React from 'react';
import { Box, Text } from 'ink';

interface CommandNotificationProps {
  selectedCommand: string;
  commandSource: 'search' | 'agent' | '';
}

const CommandNotification: React.FC<CommandNotificationProps> = ({
  selectedCommand,
  commandSource
}) => {
  if (!selectedCommand || !commandSource) {
    return null;
  }

  return (
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
  );
};

export default CommandNotification;