#!/bin/bash

# Clean installation
rm -rf node_modules
rm -f package-lock.json
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

echo "Setup completed successfully!"