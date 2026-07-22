#!/usr/bin/env node

import { startServer } from "../src/mcp/server.mjs";

startServer(process.env.CLAUDE_PROJECT_DIR || process.cwd());
