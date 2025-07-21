import React, { useState, useEffect, useCallback } from 'react';
import { searchService, SearchResult } from '../services/searchService';

export interface UseSearchReturn {
  searchResults: SearchResult[];
  showSearchResults: boolean;
  selectedSearchIndex: number;
  commandHistoryCount: number;
  searchCommandHistory: (searchTerm: string) => void;
  setSelectedSearchIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowSearchResults: React.Dispatch<React.SetStateAction<boolean>>;
  setSearchResults: React.Dispatch<React.SetStateAction<SearchResult[]>>;
  deleteCommand: (command: string) => boolean;
  updateCommandCount: () => void;
}

export const useSearch = (): UseSearchReturn => {
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const [commandHistoryCount, setCommandHistoryCount] = useState(0);

  const searchCommandHistory = useCallback((searchTerm: string): void => {
    const results = searchService.searchCommandHistory(searchTerm);
    setSearchResults(results);
    setShowSearchResults(results.length > 0);
    // Reset selected index when results change
    setSelectedSearchIndex(0);
  }, []);

  const updateCommandCount = useCallback((): void => {
    setCommandHistoryCount(searchService.getCommandCount());
  }, []);

  const deleteCommand = useCallback((command: string): boolean => {
    const deleted = searchService.deleteCommand(command);
    if (deleted) {
      updateCommandCount();
    }
    return deleted;
  }, [updateCommandCount]);

  // Initialize command count on mount
  useEffect(() => {
    updateCommandCount();
  }, [updateCommandCount]);

  return {
    searchResults,
    showSearchResults,
    selectedSearchIndex,
    commandHistoryCount,
    searchCommandHistory,
    setSelectedSearchIndex,
    setShowSearchResults,
    setSearchResults,
    deleteCommand,
    updateCommandCount
  };
};