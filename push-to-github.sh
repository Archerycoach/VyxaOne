#!/bin/bash

echo "🚀 Pushing Imogest Testing Environment to GitHub..."
echo ""

# Check if there are uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
  echo "📝 Committing remaining changes..."
  git add .
  git commit -m "chore: Final setup commit"
fi

# Push to GitHub
echo "📤 Pushing to GitHub..."
git push -u origin main

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Success! Repository pushed to GitHub"
  echo "🔗 https://github.com/Archerycoach/Imogest-Testes"
  echo ""
  echo "Next steps:"
  echo "1. Visit the repository on GitHub"
  echo "2. Review the README.md"
  echo "3. Setup database using dev-tools/production-schema.sql"
  echo "4. Start testing: npm run dev"
else
  echo ""
  echo "❌ Failed to push. You may need to:"
  echo "1. Configure Git credentials: git config credential.helper store"
  echo "2. Or use SSH: git remote set-url origin git@github.com:Archerycoach/Imogest-Testes.git"
fi