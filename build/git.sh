#!/bin/bash

set -e

read -p "📝 Commit message (default: 'update'): " COMMIT_MSG
COMMIT_MSG=${COMMIT_MSG:-update}


BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "📂 Staging all changes..."
git add .

echo "✅ Committing with message: '$COMMIT_MSG'"
git commit -m "$COMMIT_MSG"

echo "🚀 Pushing to origin/$BRANCH..."
git push origin "$BRANCH"

echo "✅ Code successfully pushed to GitHub on branch '$BRANCH'."