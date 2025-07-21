import React from 'react';
import { Box, Text } from 'ink';

interface StatusBarProps {
  currentWorkingDir: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ currentWorkingDir }) => {
  return (
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
  );
};

export default StatusBar;