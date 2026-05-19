#!/usr/bin/env node

import { run } from '../src/cli.js';

run(process.argv.slice(2)).catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
