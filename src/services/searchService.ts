import { cliDb } from '../utils/storage';

export interface SearchResult {
  label: string;
  value: string;
}

export class SearchService {
  private static instance: SearchService;

  private constructor() {}

  static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Search command history
   */
  searchCommandHistory(searchTerm: string): SearchResult[] {
    let results;

    // Check if user typed ** to show all commands
    if (searchTerm.trim() === '**') {
      // Get all command history directly
      results = cliDb.getCommandHistory(100);
      
    } else if (searchTerm.trim() === '') {
      // For empty search, don't show any results
      results = [];
    } else {
      results = cliDb.searchCommandHistory(searchTerm);
    }

    // Format results
    const formattedResults = results.map(item => ({
      label: `${item.command} (${item.no_of_time_executed}×)`,
      value: item.command
    }));

    return formattedResults;
  }

  /**
   * Delete a command from history
   */
  deleteCommand(command: string): boolean {
    return cliDb.deleteCommandFromHistory(command);
  }

  /**
   * Get total command count
   */
  getCommandCount(): number {
    return cliDb.getCommandHistoryCount();
  }
}

export const searchService = SearchService.getInstance();