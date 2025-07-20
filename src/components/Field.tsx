import React from 'react';
import { Box, Text, useFocus } from 'ink';
import SelectInput from 'ink-select-input';
import TextInput from 'ink-text-input';

interface FieldProps {
  label: string;
  children: React.ReactElement;
  isActive?: boolean;
}

const Field = ({ label, children, isActive = false }: FieldProps) => {
  let finalChild = children;

  if (children.type === SelectInput) {
    // When not active, render a disabled-looking list containing only the selected item
    if (!isActive) {
      const { items, initialIndex = 0 } = children.props;
      const selected = items[initialIndex];
      finalChild = React.cloneElement(children, {
        items: selected ? [selected] : [],
        onSelect: () => {},
      });
    }
  } else if (children.type === TextInput && !children.props.showCursor) {
    // For text inputs, we just show or hide the cursor based on active state
    finalChild = React.cloneElement(children, { showCursor: isActive });
  }

  return (
    <Box 
      borderStyle={isActive ? 'round' : undefined} 
      borderColor="cyan" 
      paddingX={1}
    >
      <Box width={15}>
        <Text>{label}:</Text>
      </Box>
      {finalChild}
    </Box>
  );
};

export default Field;
