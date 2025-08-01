#!/bin/bash

# Disable automatic exit on error to collect multiple errors
set +e

# Global variables
declare -a ERRORS=()
declare -a FIXES=()
SHOULD_RERUN=false

# Function to add errors and their fixes
add_error() {
    local error_msg="$1"
    local fix_cmd="$2"
    ERRORS+=("$error_msg")
    FIXES+=("$fix_cmd")
}

# Function to display all errors and proposed fixes
show_errors() {
    if [ ${#ERRORS[@]} -eq 0 ]; then
        return 0
    fi

    echo -e "\n\033[1;31mThe following errors occurred:\033[0m"
    for i in "${!ERRORS[@]}"; do
        echo -e "$((i+1)). ${ERRORS[$i]}"
        echo -e "   Fix: \033[1;33m${FIXES[$i]}\033[0m"
    done

    read -p $'\nDo you want to apply these fixes? (y/n): ' APPLY_FIXES

    if [[ "$APPLY_FIXES" =~ ^[Yy]$ ]]; then
        echo -e "\nApplying fixes..."
        for fix in "${FIXES[@]}"; do
            if [ -n "$fix" ]; then
                echo -e "\033[1;32mExecuting: $fix\033[0m"
                eval "$fix"
            fi
        done
        SHOULD_RERUN=true
        return 0
    else
        echo -e "\nNot applying fixes. Exiting."
        exit 1
    fi
}

# Main workflow function
git_workflow() {
    ERRORS=()
    FIXES=()

    read -p "Commit message (default: 'update'): " COMMIT_MSG
    COMMIT_MSG=${COMMIT_MSG:-update}


    if [[ -z "$COMMIT_MSG" ]]; then
        add_error "Commit message cannot be empty" ""
    fi


    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    if [ $? -ne 0 ]; then
        if ! command -v git &> /dev/null; then
            add_error "Git is not installed" "sudo apt-get install git -y"
        else
            add_error "Not in a git repository" "git init && git add . && git commit -m 'Initial commit'"
        fi
    fi


    git add . 2>/dev/null
    if [ $? -ne 0 ]; then
        add_error "No changes to stage" "echo 'No changes to stage'"
    fi


    git commit -m "$COMMIT_MSG" 2>/dev/null
    if [ $? -ne 0 ]; then
        if [ -z "$(git status --porcelain)" ]; then
            add_error "No changes to commit" "echo 'No changes to commit'"
        else
            add_error "Commit failed" "git add . && git commit -m '$COMMIT_MSG'"
        fi
    fi

    if [ -n "$BRANCH" ]; then
        git push origin "$BRANCH" 2>/dev/null
        if [ $? -ne 0 ]; then
            if git remote | grep -q '^origin$'; then
                add_error "Push rejected (may need pull)" "git pull origin $BRANCH && git push origin $BRANCH"
            else
                add_error "Remote 'origin' not configured" "read -p 'Enter remote URL: ' REMOTE_URL && git remote add origin \$REMOTE_URL && git push -u origin $BRANCH"
            fi
        fi
    fi


    if [ ${#ERRORS[@]} -gt 0 ]; then
        show_errors
        if [ "$SHOULD_RERUN" = true ]; then
            echo -e "\n\033[1;36mRe-running workflow after fixes...\033[0m"
            git_workflow
        fi
    else
        echo -e "\n\033[1;32mCode successfully pushed to GitHub on branch '$BRANCH'.\033[0m"
    fi
}

git_workflow