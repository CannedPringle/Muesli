# Whisper Journal

A local-first macOS app for voice journaling. Record or upload audio, transcribe locally with whisper.cpp, format structured journal entries using Ollama with GPT-OSS, and save as Markdown notes to your Obsidian vault.

**All processing happens on your machine. No cloud services, no data leaves your computer.**

## Features

- **Voice Recording** - Record directly in the browser with real-time audio levels
- **Audio Upload** - Or upload existing audio files (mp3, m4a, wav, webm, ogg)
- **Local Transcription** - Uses whisper.cpp for fast, private speech-to-text
- **AI Formatting** - Ollama with GPT-OSS (OpenAI's open-weight model) structures your thoughts
- **Obsidian Integration** - Saves as Markdown with frontmatter to your vault
- **Dark Mode** - System-aware theme with manual toggle
- **Multiple Entry Types**:
  - **Brain Dump** - Free-form thoughts, automatically summarized
  - **Daily Reflection** - Guided prompts for gratitude, accomplishments, challenges
  - **Quick Note** - Minimal processing, just transcribe and save

## Prerequisites

Before running Whisper Journal, you need:

### 1. ffmpeg (for audio processing)

```bash
brew install ffmpeg
```

### 2. CMake (for building whisper.cpp)

```bash
brew install cmake
```

### 3. Ollama (for AI formatting)

```bash
brew install ollama
```

Then pull the GPT-OSS model (OpenAI's open-weight model, ~14GB):

```bash
ollama pull gpt-oss:20b
```

Optionally, pull Qwen 3 as a faster alternative (~5GB):

```bash
ollama pull qwen3:8b
```

> **Note:** GPT-OSS 20B requires 16GB+ RAM. If you want something lighter, use `qwen3:8b` instead.

Make sure Ollama is running:

```bash
ollama serve
```

### 4. whisper.cpp (for transcription)

The app includes a setup script that downloads and compiles whisper.cpp with the small model (~500MB):

```bash
npm run setup:whisper
```

This will:
- Clone whisper.cpp to `~/.whisper/whisper.cpp`
- Compile with **Metal acceleration** (automatic on Apple Silicon)
- Download the small model (~500MB)

Other model sizes available:
```bash
npm run setup:whisper:tiny    # ~75MB, fastest
npm run setup:whisper:base    # ~150MB
npm run setup:whisper:small   # ~500MB (default, recommended)
npm run setup:whisper:medium  # ~1.5GB
npm run setup:whisper:large   # ~3GB, most accurate
```

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/whisper-journal.git
cd whisper-journal

# Install dependencies
npm install

# Set up whisper.cpp (includes Metal acceleration on Apple Silicon)
npm run setup:whisper

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## First-Time Setup

1. Open the app and go to **Settings** (gear icon)
2. Set your **Obsidian Vault Path** - this is where journal entries will be saved
3. Verify all prerequisites show as installed (green checkmarks)
4. Return to the main page and create your first entry!

## Usage

### Creating a Journal Entry

1. **Choose Entry Type** - Brain Dump, Daily Reflection, or Quick Note
2. **Record or Upload Audio** - Click the microphone to record, or drag & drop a file
3. **Review Transcript** - Edit the transcription if needed, then approve
4. **Answer Prompts** (Daily Reflection only) - Optional guided questions
5. **Generate Note** - AI formats your entry as Markdown
6. **Open in Obsidian** - Click to open the saved note

### Entry Types Explained

| Type | Best For | Process |
|------|----------|---------|
| **Brain Dump** | Free-form thoughts, ideas, venting | Transcribe → AI Summary → Save |
| **Daily Reflection** | End-of-day review | Transcribe → Guided Prompts → AI Reflection → Save |
| **Quick Note** | Fast capture, meeting notes | Transcribe → Save (minimal AI) |

## Configuration

Settings are stored in SQLite at `./data/journal.db`. You can configure:

| Setting | Default | Description |
|---------|---------|-------------|
| Vault Path | (none) | Path to your Obsidian vault folder |
| Whisper Model | small | Model size: tiny, base, small, medium, large |
| Ollama URL | http://localhost:11434 | Ollama API endpoint |
| Ollama Model | gpt-oss:20b | LLM for formatting entries |
| Keep Audio | true | Retain audio files after processing |
| Timezone | System default | Timezone for entry dates |

### Alternative Models

You can use other models in Settings. Some options:

| Model | Command | Size | Notes |
|-------|---------|------|-------|
| **GPT-OSS 20B** | `ollama pull gpt-oss:20b` | 14GB | Default, OpenAI open-weight |
| **GPT-OSS 120B** | `ollama pull gpt-oss:120b` | 65GB | Larger, needs 80GB VRAM |
| **Qwen 3 8B** | `ollama pull qwen3:8b` | 5.2GB | Fast & capable alternative |
| Qwen 2.5 7B | `ollama pull qwen2.5:7b` | 4GB | Good balance |
| Llama 3.2 3B | `ollama pull llama3.2:3b` | 2GB | Faster, smaller |
| Mistral 7B | `ollama pull mistral:7b` | 4GB | Good for writing |

## File Structure

Journal entries are saved as Markdown with this structure:

```
your-vault/
  journal/
    2026-01-11-143547-brain-dump.md
    2026-01-11-220000-daily-reflection.md
```

Each file includes:
- YAML frontmatter with metadata
- Transcript section (immutable after creation)
- AI-generated sections (can be regenerated)
- Section markers for safe re-processing

## Development

```bash
# Run development server
npm run dev

# Type checking
npm run lint

# Production build
npm run build
npm start
```

## Data Storage

All data is stored locally:

- **Database**: `./data/journal.db` (SQLite)
- **Audio files**: `./data/audio/` (if keep_audio enabled)
- **Journal notes**: Your configured Obsidian vault
- **whisper.cpp**: `~/.whisper-journal/whisper.cpp`

## Troubleshooting

### "ffmpeg not found"
```bash
brew install ffmpeg
```

### "cmake not found"
```bash
brew install cmake
```

### "Ollama not responding"
Make sure Ollama is running:
```bash
ollama serve
```

### "Model not found"
Pull the model first:
```bash
ollama pull gpt-oss:20b
```

### "whisper.cpp not found"
Run the setup script:
```bash
npm run setup:whisper
```

### Transcription is slow
- Use the `small` model (default) for best speed/quality balance
- Metal acceleration is automatic on Apple Silicon Macs
- The `tiny` model is faster but less accurate: `npm run setup:whisper:tiny`

### Audio not recording
- Make sure your browser has microphone permissions
- Check that your microphone is working in System Preferences

### Out of memory
- GPT-OSS 20B requires ~16GB RAM
- Try a smaller model like `qwen2.5:7b` or `llama3.2:3b`

## License

MIT

## Acknowledgments

- [GPT-OSS](https://ollama.com/library/gpt-oss) - OpenAI's open-weight model
- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Local speech recognition
- [Ollama](https://ollama.ai) - Local LLM inference
- [Next.js](https://nextjs.org) - React framework
- [shadcn/ui](https://ui.shadcn.com) - UI components
