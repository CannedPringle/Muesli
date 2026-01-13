#!/bin/bash

# Download Silero VAD model for whisper.cpp
# This enables Voice Activity Detection which improves transcription accuracy
# especially for audio with pauses or background noise

set -e

WHISPER_DIR="$HOME/.whisper"
MODELS_DIR="$WHISPER_DIR/models"
VAD_MODEL="silero-v5.1.2"
VAD_URL="https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-${VAD_MODEL}.bin"

echo "=== VAD Model Download Script ==="
echo "Model: $VAD_MODEL"
echo "Install directory: $MODELS_DIR"
echo ""

# Create directories
mkdir -p "$MODELS_DIR"

VAD_PATH="$MODELS_DIR/ggml-${VAD_MODEL}.bin"

if [ -f "$VAD_PATH" ]; then
    echo "VAD model already exists at $VAD_PATH"
    echo ""
    echo "To use VAD, enable it in Muesli settings:"
    echo "  - Set vad_enabled to true"
    echo "  - Set vad_model_path to: $VAD_PATH"
else
    echo "Downloading VAD model..."
    curl -L --progress-bar "$VAD_URL" -o "$VAD_PATH"
    echo ""
    echo "VAD model saved to: $VAD_PATH"
    echo ""
    echo "To use VAD, enable it in Muesli settings:"
    echo "  - Set vad_enabled to true"
    echo "  - Set vad_model_path to: $VAD_PATH"
fi

echo ""
echo "=== Setup Complete ==="
