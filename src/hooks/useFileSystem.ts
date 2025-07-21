import React, { useState, useCallback } from 'react';
import fs from 'fs';
import path from 'path';

export interface FileSystemItem {
  label: string;
  value: string;
  isDirectory: boolean;
}

export interface UseFileSystemReturn {
  fileBrowserItems: FileSystemItem[];
  showFileBrowser: boolean;
  selectedFileIndex: number;
  currentBrowsingPath: string;
  scanDirectory: (dirPath: string) => void;
  setSelectedFileIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowFileBrowser: React.Dispatch<React.SetStateAction<boolean>>;
  setFileBrowserItems: React.Dispatch<React.SetStateAction<FileSystemItem[]>>;
  getDriveRoots: () => FileSystemItem[];
}

export const useFileSystem = (): UseFileSystemReturn => {
  const [fileBrowserItems, setFileBrowserItems] = useState<FileSystemItem[]>([]);
  const [showFileBrowser, setShowFileBrowser] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [currentBrowsingPath, setCurrentBrowsingPath] = useState<string>('');

  const scanDirectory = useCallback((dirPath: string): void => {
    try {
      const items = fs.readdirSync(dirPath, { withFileTypes: true });
      const formattedItems = items
        .map(item => ({
          label: item.isDirectory() ? `📁 ${item.name}/` : `📄 ${item.name}`,
          value: path.join(dirPath, item.name),
          isDirectory: item.isDirectory()
        }))
        .sort((a, b) => {
          // Directories first, then files, both alphabetically
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.label.localeCompare(b.label);
        });

      setFileBrowserItems(formattedItems);
      setSelectedFileIndex(0);
      setShowFileBrowser(formattedItems.length > 0);
      setCurrentBrowsingPath(dirPath);
    } catch (error) {
      console.error('Error scanning directory:', error);
      setFileBrowserItems([]);
      setShowFileBrowser(false);
    }
  }, []);

  const getDriveRoots = useCallback((): FileSystemItem[] => {
    const drives: FileSystemItem[] = [];
    // Common Windows drives
    for (let drive = 'A'.charCodeAt(0); drive <= 'Z'.charCodeAt(0); drive++) {
      const driveLetter = String.fromCharCode(drive);
      const drivePath = `${driveLetter}:\\`;
      try {
        fs.accessSync(drivePath);
        drives.push({
          label: `💽 ${driveLetter}: Drive`,
          value: drivePath,
          isDirectory: true
        });
      } catch (error) {
        // Drive doesn't exist, skip
      }
    }
    return drives;
  }, []);

  return {
    fileBrowserItems,
    showFileBrowser,
    selectedFileIndex,
    currentBrowsingPath,
    scanDirectory,
    setSelectedFileIndex,
    setShowFileBrowser,
    setFileBrowserItems,
    getDriveRoots
  };
};