import React from 'react';
import { Box, Text } from 'ink';

interface CliHistoryItem {
  type: 'command' | 'output';
  content: string;
  timestamp: Date;
}

interface CliSessionProps {
  history: CliHistoryItem[];
  currentWorkingDir: string;
}

const CliSession = ({ history, currentWorkingDir }: CliSessionProps) => {
  const formatHistoryLine = (item: CliHistoryItem) => {
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

export default CliSession;
export type { CliHistoryItem };