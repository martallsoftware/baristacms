#!/bin/bash

# Navigate to deployment directory
cd "$DEPLOYMENT_TARGET" || cd /home/site/wwwroot

# Install dependencies (this compiles native modules for Linux)
npm install --production

echo "Deployment complete!"
