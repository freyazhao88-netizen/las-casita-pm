#!/bin/bash
cd "$(dirname "$0")"
export PATH="$(pwd)/.tools/node-v20.20.2-darwin-arm64/bin:$PATH"
echo "Starting Las Casita Project Manager..."
echo "Once it says 'running at http://localhost:4173', open that link in your browser."
echo "Leave this window open while you use the app. Press Ctrl+C here to stop it."
echo ""
node server.js
