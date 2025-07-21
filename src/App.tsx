import React from 'react';

import { loadSettings } from './utils/config';
import CLI from './components/Cli';

const App = () => {
  const settings = loadSettings();
  return <CLI initialSettings={settings} />;
};

export default App;
