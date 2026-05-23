#!/bin/bash
cd "$(dirname "$0")"
NODE_ENV=production npx tsx server/index.ts
