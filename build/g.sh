#!/bin/bash

LOG_FILE="gitlog.txt"
exec > >(tee -a "$LOG_FILE") 2>&1
set -x  # Show each command being run

check_files_in_git() {
    echo -e "\n\033[1;36m=== Checking git status ===\033[0m"
    git status
    echo -e "\n\033[1;36m=== Files in repository ===\033[0m"
    git ls-files
}

read -p "Commit message (default: 'update'): " COMMIT_MSG
COMMIT_MSG=${COMMIT_MSG:-update}

echo -e "\n\033[1;33m1. Checking git repository...\033[0m"
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>&1)
if [ $? -ne 0 ]; then
    echo -e "\033[1;31mNot in a git repository!\033[0m"
    read -p "Initialize new repository here? (y/n): " INIT_REPO
    if [[ "$INIT_REPO" =~ ^[Yy]$ ]]; then
        git init
        git add .
        git commit -m "Initial commit"
    else
        exit 1
    fi
fi

echo -e "\n\033[1;33m2. Checking remote repository...\033[0m"
if ! git remote | grep -q 'origin'; then
    echo -e "\033[1;31mNo remote 'origin' configured!\033[0m"
    read -p "Enter GitHub repository URL (or leave empty to skip): " REPO_URL
    if [ -n "$REPO_URL" ]; then
        git remote add origin "$REPO_URL"
    fi
fi

echo -e "\n\033[1;33m3. Staging files...\033[0m"
git add .
check_files_in_git

echo -e "\n\033[1;33m4. Making commit...\033[0m"
git commit -m "$COMMIT_MSG" || {
    echo -e "\033[1;31mCommit failed! Checking why...\033[0m"
    if [ -z "$(git status --porcelain)" ]; then
        echo -e "\033[1;33mNo changes to commit.\033[0m"
    else
        echo -e "\033[1;31mUnknown commit error.\033[0m"
    fi
    check_files_in_git
    exit 1
}

echo -e "\n\033[1;33m5. Pushing to GitHub...\033[0m"
if git push origin "$BRANCH"; then
    echo -e "\n\033[1;32mSuccess! Verify your files on GitHub:\033[0m"
    if git remote -v | grep -q 'github.com'; then
        REPO_URL=$(git remote get-url origin | sed 's/git@github.com:/https:\/\/github.com\//' | sed 's/\.git$//')
        echo -e "Open in browser: $REPO_URL/tree/$BRANCH"
    fi
else
    echo -e "\n\033[1;31mPush failed! Trying to diagnose...\033[0m"
    if git push origin "$BRANCH" 2>&1 | grep -q 'has no upstream branch'; then
        echo -e "\033[1;33mSetting upstream branch...\033[0m"
        git push --set-upstream origin "$BRANCH"
    else
        echo -e "\033[1;31mUnknown push error. Try manually with:\033[0m"
        echo -e "git push origin $BRANCH"
        check_files_in_git
    fi
fi

echo -e "\n\033[1;36m=== Final verification ===\033[0m"
check_files_in_git