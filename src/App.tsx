import React from 'react';
import CLI from './components/CLI_1';
import { loadSettings } from './utils/config';

const App = () => {
  const settings = loadSettings();
  return <CLI initialSettings={settings} />;
};

export default App;
