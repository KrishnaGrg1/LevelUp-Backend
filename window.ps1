# Clean installation
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install

# Generate Prisma client
npx prisma generate

# Push database schema
npx prisma db push

Write-Host "Setup completed successfully!"