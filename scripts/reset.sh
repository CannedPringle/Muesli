#!/bin/bash
# Reset Muesli - clears database and optionally vault journal folder

set -e

echo "=== Muesli Reset ==="
echo ""
echo "This will delete:"
echo "  - SQLite database (all entry records)"
echo ""

# Check if vault path is configured
VAULT_PATH=""
if [ -f "./data/journal.db" ]; then
  VAULT_PATH=$(sqlite3 ./data/journal.db "SELECT value FROM settings WHERE key='vault_path';" 2>/dev/null || echo "")
fi

DELETE_VAULT="n"
if [ -n "$VAULT_PATH" ] && [ -d "$VAULT_PATH" ]; then
  echo "Detected vault path: $VAULT_PATH"
  echo ""
  echo "The journal folder contains:"
  echo "  - Journal notes (markdown files)"
  echo "  - Audio recordings (in journal/audio/)"
  echo ""
  read -p "Also delete journal folder from Obsidian vault? (y/N) " -n 1 -r DELETE_VAULT
  echo ""
fi

echo ""
read -p "Proceed with reset? (y/N) " -n 1 -r CONFIRM
echo ""

if [[ ! $CONFIRM =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 0
fi

echo ""

# Delete database files
if [ -f "./data/journal.db" ] || [ -f "./data/journal.db-wal" ] || [ -f "./data/journal.db-shm" ]; then
  echo "Removing database..."
  rm -f ./data/journal.db
  rm -f ./data/journal.db-wal
  rm -f ./data/journal.db-shm
else
  echo "No database files found."
fi

# Delete vault journal folder if requested
if [[ $DELETE_VAULT =~ ^[Yy]$ ]] && [ -n "$VAULT_PATH" ] && [ -d "$VAULT_PATH" ]; then
  JOURNAL_DIR="$VAULT_PATH/journal"
  
  if [ -d "$JOURNAL_DIR" ]; then
    echo "Removing journal folder from vault..."
    
    # Count items
    NOTE_COUNT=$(find "$JOURNAL_DIR" -maxdepth 1 -type f -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    AUDIO_COUNT=$(find "$JOURNAL_DIR/audio" -type f 2>/dev/null | wc -l | tr -d ' ')
    
    # Remove the journal folder
    rm -rf "$JOURNAL_DIR"
    
    echo "Removed $NOTE_COUNT note(s) and $AUDIO_COUNT audio file(s) from vault."
  else
    echo "No journal folder found in vault."
  fi
fi

echo ""
echo "Reset complete!"
echo ""
echo "Run 'npm run dev' to start fresh with a new database."
