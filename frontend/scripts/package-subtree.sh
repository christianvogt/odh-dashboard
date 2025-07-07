#!/bin/bash

set -e

# Simple script to sync upstream repository content into monorepo
# Usage: ./package-subtree.sh <package-name> [commit-sha]

if [ -z "$1" ]; then
  echo "Usage: $0 <package-name> [commit-sha]"
  exit 1
fi

# Variables
PACKAGE_NAME="$1"
COMMIT_SHA="$2"
MONOREPO_ROOT="$(git rev-parse --show-toplevel)"
PACKAGE_JSON="$MONOREPO_ROOT/frontend/packages/$PACKAGE_NAME/package.json"

# Change to monorepo root to ensure we're in a safe directory
cd "$MONOREPO_ROOT"

# Check clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree has uncommitted changes"
  exit 1
fi

# Read config from package.json
UPSTREAM_REPO=$(jq -r '.subtree.repo' "$PACKAGE_JSON")
UPSTREAM_SUBDIR=$(jq -r '.subtree.src // ""' "$PACKAGE_JSON")
TARGET_RELATIVE=$(jq -r '.subtree.target' "$PACKAGE_JSON")
CURRENT_COMMIT=$(jq -r '.subtree.commit // ""' "$PACKAGE_JSON")

# Derive target path (relative to package directory)
TARGET_DIR="$MONOREPO_ROOT/frontend/packages/$PACKAGE_NAME/$TARGET_RELATIVE"

echo "Syncing $PACKAGE_NAME from $UPSTREAM_REPO"

# Set up temp directory
TMP_DIR=$(mktemp -d)
trap "cd '$MONOREPO_ROOT'; rm -rf '$TMP_DIR'" EXIT

# Clone upstream repository
git clone -q "$UPSTREAM_REPO" "$TMP_DIR/repo"
cd "$TMP_DIR/repo"

# Get target commit SHA
if [ -n "$COMMIT_SHA" ]; then
  git checkout -q "$COMMIT_SHA"
  ACTUAL_COMMIT=$(git rev-parse HEAD)
else
  ACTUAL_COMMIT=$(git rev-parse HEAD)
fi

# Early exit if no changes
if [ "$CURRENT_COMMIT" = "$ACTUAL_COMMIT" ] && [ -d "$TARGET_DIR" ]; then
  echo "Already up-to-date at $ACTUAL_COMMIT"
  exit 0
fi

# Return to monorepo root for remaining operations
cd "$MONOREPO_ROOT"

# Handle initial setup (when no previous commit exists)
if [ -z "$CURRENT_COMMIT" ] || [ "$CURRENT_COMMIT" = "null" ] || [ "$CURRENT_COMMIT" = "" ]; then
  echo "Initial setup: copying upstream content"
  rm -rf "$TARGET_DIR"
  mkdir -p "$TARGET_DIR"
  
  if [ -n "$UPSTREAM_SUBDIR" ]; then
    cp -r "$TMP_DIR/repo/$UPSTREAM_SUBDIR/." "$TARGET_DIR/"
  else
    cp -r "$TMP_DIR/repo/." "$TARGET_DIR/"
  fi
else
  echo "Applying patch from $CURRENT_COMMIT to $ACTUAL_COMMIT"
  
  # Generate patch between commits
  cd "$TMP_DIR/repo"
  
  # Create patch file
  PATCH_FILE="$TMP_DIR/upstream.patch"
  if [ -n "$UPSTREAM_SUBDIR" ]; then
    # Generate patch for subdirectory only
    git diff "$CURRENT_COMMIT..$ACTUAL_COMMIT" -- "$UPSTREAM_SUBDIR" > "$PATCH_FILE"
    
    # Adjust patch paths to remove the subdirectory prefix
    sed "s|a/$UPSTREAM_SUBDIR/|a/|g" "$PATCH_FILE" | sed "s|b/$UPSTREAM_SUBDIR/|b/|g" > "$PATCH_FILE.tmp"
    mv "$PATCH_FILE.tmp" "$PATCH_FILE"
  else
    # Generate patch for entire repository
    git diff "$CURRENT_COMMIT..$ACTUAL_COMMIT" > "$PATCH_FILE"
  fi
  
  # Return to monorepo root
  cd "$MONOREPO_ROOT"
  
  # Check if patch is empty
  if [ ! -s "$PATCH_FILE" ]; then
    echo "No changes between $CURRENT_COMMIT and $ACTUAL_COMMIT"
  else
    # Apply patch to target directory
    cd "$TARGET_DIR"
    
    # Try to apply the patch using patch command which handles conflicts better
    if patch -p1 --dry-run < "$PATCH_FILE" >/dev/null 2>&1; then
      echo "✅ Applying patch cleanly"
      patch -p1 < "$PATCH_FILE"
    else
      echo "⚠️  Patch has conflicts, applying with conflict markers"
      
      # Apply patch with conflict markers (like git merge conflicts)
      if patch -p1 --merge < "$PATCH_FILE" 2>/dev/null; then
        echo "✅ Patch applied with conflict markers"
        echo "Files with conflicts have been marked with <<<<<<< ======= >>>>>>> markers"
        echo "Please resolve the conflicts in the files and run the script again"
        
        cd "$MONOREPO_ROOT"
        
        # Find and list files with conflict markers
        CONFLICT_FILES=$(find "$TARGET_DIR" -type f -exec grep -l "<<<<<<< " {} \; 2>/dev/null | sed "s|$MONOREPO_ROOT/||g" || true)
        if [ -n "$CONFLICT_FILES" ]; then
          echo "Files with conflicts:"
          echo "$CONFLICT_FILES"
        fi
        
        # Don't exit with error - let user resolve conflicts and continue
        echo "After resolving conflicts, run the script again to complete the update"
      else
        echo "❌ Patch application failed, trying with reject files"
        
        # Fallback to reject files approach
        patch -p1 --reject-file=- < "$PATCH_FILE" 2>/dev/null || true
        
        cd "$MONOREPO_ROOT"
        echo "Some changes couldn't be applied automatically."
        echo "Please review the changes manually in: $TARGET_DIR"
        echo "Run the script again after resolving conflicts"
      fi
      
      exit 1
    fi
    
    # Return to monorepo root
    cd "$MONOREPO_ROOT"
  fi
fi

# Update package.json with the new commit ID
jq --arg commit "$ACTUAL_COMMIT" '.subtree.commit = $commit' "$PACKAGE_JSON" > "$PACKAGE_JSON.tmp"
mv "$PACKAGE_JSON.tmp" "$PACKAGE_JSON"

# Stage all changes and commit as single commit
git add "frontend/packages/$PACKAGE_NAME"
if ! git diff --cached --quiet; then
  if [ -z "$CURRENT_COMMIT" ] || [ "$CURRENT_COMMIT" = "null" ] || [ "$CURRENT_COMMIT" = "" ]; then
    git commit -m "Initialize $PACKAGE_NAME at $ACTUAL_COMMIT"
    echo "✅ Initialized $PACKAGE_NAME at $ACTUAL_COMMIT"
  else
    git commit -m "Update $PACKAGE_NAME from $CURRENT_COMMIT to $ACTUAL_COMMIT"
    echo "✅ Updated $PACKAGE_NAME from $CURRENT_COMMIT to $ACTUAL_COMMIT"
  fi
else
  echo "ℹ️ Already up-to-date at $ACTUAL_COMMIT"
fi
