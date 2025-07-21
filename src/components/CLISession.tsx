import React from 'react';
import { Box, Text } from 'ink';

interface CLIHistoryItem {
  type: 'command' | 'output';
  content: string;
  timestamp: Date;
}

interface CLISessionProps {
  history: CLIHistoryItem[];
  currentWorkingDir: string;
}

const CLISession = ({ history, currentWorkingDir }: CLISessionProps) => {
  const formatHistoryLine = (item: CLIHistoryItem) => {
    if (item.type === 'command') {
      return `> ${item.content}`;
    }
    return item.content;
  };

  return (
    <Box flexDirection="column" flexGrow={1} flexShrink={0} flexBasis="75%" overflowY="visible">
      {history.map((item, index) => {
        const formattedLine = formatHistoryLine(item);
        
        // Command lines in different color
        if (item.type === 'command') {
          return (
            <Box key={index} flexDirection="row">
              <Text color="cyan" bold>{formattedLine}</Text>
            </Box>
          );
        }
        
        // Output lines
        return <Text key={index}>{formattedLine}</Text>;
      })}
    </Box>
  );
};

export default CLISession;
export type { CLIHistoryItem };