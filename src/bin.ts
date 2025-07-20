#!/usr/bin/env node

import { render } from 'ink';
import React from 'react';
import App from './App.js';
import { ensureHomeDirectory } from './utils/storage.js';

// Ensure the CLI home directory structure exists
ensureHomeDirectory();

// Render the CLI application
render(React.createElement(App));
