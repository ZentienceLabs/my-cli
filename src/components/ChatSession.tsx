import React from 'react';
import { Box, Text } from 'ink';

interface ChatHistoryItem {
  type: 'question' | 'answer';
  content: string;
  timestamp: Date;
}

interface ChatSessionProps {
  history: ChatHistoryItem[];
  isProcessing?: boolean;
}

const ChatSession = ({ history, isProcessing }: ChatSessionProps) => {
  const formatHistoryLine = (item: ChatHistoryItem) => {
    if (item.type === 'question') {
      return { label: 'Question', content: item.content };
    }
    return { label: 'AI', content: item.content };
  };

  return (
    <Box flexGrow={1} flexDirection="column" flexShrink={0} flexBasis="75%" overflowY="visible">
      {history.map((item, index) => {
        const { label, content } = formatHistoryLine(item);
        
        // Add spacing between Q&A pairs
        const isNewUserQuestion = label === 'Question' && index > 0 && formatHistoryLine(history[index - 1]).label === 'AI';
        if (isNewUserQuestion) {
          return (
            <React.Fragment key={index}>
              <Box height={1}></Box>
              <Box flexDirection="row">
                <Box width="8%" justifyContent="flex-end">
                  <Text bold>{label}</Text>
                </Box>
                <Box width="1%"><Text>:</Text></Box>
                <Box><Text>{content}</Text></Box>
              </Box>
            </React.Fragment>
          );
        }
        
        // Add loading animation to the last line if it's the loader and processing
        if (isProcessing && index === history.length - 1 && content === 'Thinking...') {
          return (
            <Box key={index} flexDirection="row">
              <Box width="8%" justifyContent="flex-end">
                <Text bold color="yellow">{label}</Text>
              </Box>
              <Box width="1%"><Text color="yellow">:</Text></Box>
              <Box><Text color="yellow">Thinking...</Text></Box>
            </Box>
          );
        }
        
        // Regular chat message
        return (
          <Box key={index} flexDirection="row">
            <Box width="8%" justifyContent="flex-end">
              <Text bold>{label}</Text>
            </Box>
            <Box width="1%"><Text>:</Text></Box>
            <Box><Text>{content}</Text></Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default ChatSession;
export type { ChatHistoryItem };