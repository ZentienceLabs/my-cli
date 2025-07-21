#!/usr/bin/env node

import { render } from 'ink';
import React from 'react';
import App from './App';
import { ensureHomeDirectory } from './utils/storage';

// Ensure the CLI home directory structure exists
ensureHomeDirectory();

// Render the CLI application
render(React.createElement(App));
