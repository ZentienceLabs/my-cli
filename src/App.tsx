import React from 'react';
import Cli from './components/Cli.js';
import { loadSettings } from './utils/config.js';

const App = () => {
  const settings = loadSettings();
  return <Cli initialSettings={settings} />;
};

export default App;
