#!/bin/bash

# Whisper.cpp setup script for macOS
# Downloads and compiles whisper.cpp with Metal support, then downloads the model

set -e

WHISPER_DIR="$HOME/.whisper"
WHISPER_CPP_DIR="$WHISPER_DIR/whisper.cpp"
MODELS_DIR="$WHISPER_DIR/models"

# Default model (can be overridden with argument)
MODEL_NAME="${1:-small}"

echo "=== Whisper.cpp Setup Script ==="
echo "Model: $MODEL_NAME"
echo "Install directory: $WHISPER_DIR"
echo ""

# Create directories
mkdir -p "$WHISPER_DIR"
mkdir -p "$MODELS_DIR"

# Check for required tools
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed. Please install Xcode Command Line Tools:"
    echo "  xcode-select --install"
    exit 1
fi

if ! command -v cmake &> /dev/null; then
    echo "Error: cmake is not installed. Please install it:"
    echo "  brew install cmake"
    exit 1
fi

# Clone or update whisper.cpp
if [ -d "$WHISPER_CPP_DIR" ]; then
    echo "Updating whisper.cpp..."
    cd "$WHISPER_CPP_DIR"
    git pull
else
    echo "Cloning whisper.cpp..."
    git clone https://github.com/ggerganov/whisper.cpp.git "$WHISPER_CPP_DIR"
    cd "$WHISPER_CPP_DIR"
fi

# Build with CMake and Metal support (macOS)
echo ""
echo "Building whisper.cpp with Metal support..."

# Clean previous build if exists
rm -rf build

# Configure with CMake - enable Metal for Apple Silicon
cmake -B build -DWHISPER_METAL=ON -DCMAKE_BUILD_TYPE=Release

# Build
cmake --build build --config Release -j$(sysctl -n hw.ncpu)

# Find the built binary (could be whisper-cli or main depending on version)
WHISPER_BIN=""
if [ -f "$WHISPER_CPP_DIR/build/bin/whisper-cli" ]; then
    WHISPER_BIN="$WHISPER_CPP_DIR/build/bin/whisper-cli"
elif [ -f "$WHISPER_CPP_DIR/build/bin/main" ]; then
    WHISPER_BIN="$WHISPER_CPP_DIR/build/bin/main"
elif [ -f "$WHISPER_CPP_DIR/build/whisper-cli" ]; then
    WHISPER_BIN="$WHISPER_CPP_DIR/build/whisper-cli"
elif [ -f "$WHISPER_CPP_DIR/build/main" ]; then
    WHISPER_BIN="$WHISPER_CPP_DIR/build/main"
else
    echo "Error: Build failed. Could not find whisper binary."
    echo "Looking in build directory:"
    find "$WHISPER_CPP_DIR/build" -type f -perm +111 -name "*whisper*" -o -name "main" 2>/dev/null || true
    exit 1
fi

echo "Build successful! Binary: $WHISPER_BIN"

# Download model
MODEL_FILE="ggml-$MODEL_NAME.bin"
MODEL_PATH="$MODELS_DIR/$MODEL_FILE"

if [ -f "$MODEL_PATH" ]; then
    echo ""
    echo "Model $MODEL_FILE already exists at $MODEL_PATH"
else
    echo ""
    echo "Downloading $MODEL_FILE..."
    
    # Use the download script from whisper.cpp
    cd "$WHISPER_CPP_DIR"
    bash ./models/download-ggml-model.sh "$MODEL_NAME"
    
    # Move model to our models directory
    if [ -f "$WHISPER_CPP_DIR/models/$MODEL_FILE" ]; then
        mv "$WHISPER_CPP_DIR/models/$MODEL_FILE" "$MODEL_PATH"
        echo "Model saved to: $MODEL_PATH"
    else
        echo "Error: Model download failed."
        exit 1
    fi
fi

# Create a symlink for easy access
MAIN_SYMLINK="$WHISPER_DIR/whisper"
if [ -L "$MAIN_SYMLINK" ] || [ -f "$MAIN_SYMLINK" ]; then
    rm "$MAIN_SYMLINK"
fi
ln -s "$WHISPER_BIN" "$MAIN_SYMLINK"

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Whisper binary: $MAIN_SYMLINK"
echo "Model path: $MODEL_PATH"
echo ""
echo "Test with:"
echo "  $MAIN_SYMLINK -m $MODEL_PATH -f /path/to/audio.wav"
echo ""
