# Muesli

Private AI journaling for macOS. Like [Granola](https://granola.ai), but for your thoughts.

**All processing happens locally. No cloud services, no data leaves your Mac.**

Record your voice, get beautifully structured journal entries. Muesli uses whisper.cpp for transcription and Ollama for formatting - everything runs on your machine.

## Features

- **Voice Recording** - Record directly in the browser with real-time audio levels
- **Audio Upload** - Import existing audio files (mp3, m4a, wav, webm, ogg)
- **Local Transcription** - whisper.cpp with Metal acceleration on Apple Silicon
- **AI Formatting** - Ollama structures your raw thoughts into organized entries
- **Obsidian Integration** - Saves as Markdown with YAML frontmatter
- **Dark Mode** - System-aware theme with manual toggle

### Entry Types

| Type | Best For | What Happens |
|------|----------|--------------|
| **Brain Dump** | Free-form thoughts, ideas | Transcribe → AI summarizes and organizes |
| **Daily Reflection** | End-of-day review | Transcribe → Guided prompts → AI reflection |
| **Quick Note** | Fast capture, meeting notes | Transcribe → Save (minimal processing) |

## Prerequisites

Muesli requires these tools installed on your Mac:

### 1. ffmpeg

```bash
brew install ffmpeg
```

### 2. CMake

```bash
brew install cmake
```

### 3. Ollama

```bash
brew install ollama
ollama pull gpt-oss:20b
ollama serve
```

> GPT-OSS 20B needs ~16GB RAM. For lighter options: `qwen3:8b` (5GB) or `llama3.2:3b` (2GB)

### 4. whisper.cpp

Muesli includes a setup script that compiles whisper.cpp with Metal support:

```bash
npm run setup:whisper:small   # Recommended (~500MB)
```

Other model options:

| Model | Command | Size | Notes |
|-------|---------|------|-------|
| tiny | `npm run setup:whisper:tiny` | ~75MB | Fastest, basic accuracy |
| small | `npm run setup:whisper:small` | ~500MB | **Recommended** |
| medium | `npm run setup:whisper:medium` | ~1.5GB | Better accuracy |
| large | `npm run setup:whisper:large` | ~3GB | Best accuracy |

## Quick Start

```bash
git clone https://github.com/CannedPringle/muesli.git
cd muesli
npm install
npm run setup:whisper:small
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and configure your Obsidian vault path in Settings.

## Configuration

Settings are stored in SQLite at `./data/journal.db`:

| Setting | Default | Description |
|---------|---------|-------------|
| Vault Path | — | Path to your Obsidian vault |
| Whisper Model | small | Model size for transcription |
| Ollama URL | http://localhost:11434 | Ollama API endpoint |
| Ollama Model | gpt-oss:20b | LLM for formatting |
| Keep Audio | true | Retain audio after processing |

### Alternative LLMs

| Model | Command | Size |
|-------|---------|------|
| GPT-OSS 20B | `ollama pull gpt-oss:20b` | 14GB |
| Qwen 3 8B | `ollama pull qwen3:8b` | 5GB |
| Qwen 2.5 7B | `ollama pull qwen2.5:7b` | 4GB |
| Llama 3.2 3B | `ollama pull llama3.2:3b` | 2GB |

## Output Format

Journal entries are saved as Markdown:

```
your-vault/
  journal/
    2026-01-12-143022-brain-dump.md
    2026-01-12-220000-daily-reflection.md
```

Each file includes YAML frontmatter, your transcript, and AI-generated sections.

## Data Storage

All data stays on your machine:

| Data | Location |
|------|----------|
| Database | `./data/journal.db` |
| Audio files | `{vault}/journal/audio/` |
| Journal notes | `{vault}/journal/` |
| whisper.cpp | `~/.whisper/` |

## Troubleshooting

**Ollama not responding**
```bash
ollama serve
```

**Model not found**
```bash
ollama pull gpt-oss:20b
```

**Whisper model missing**
```bash
npm run setup:whisper:small
```

**Transcription slow** - Use `small` model (default) or `tiny` for speed.

**Out of memory** - Try a smaller LLM like `qwen2.5:7b` or `llama3.2:3b`.

## Development

```bash
npm run dev     # Start dev server
npm run build   # Production build
npm run lint    # ESLint
npm run reset   # Clear database and audio
```

## Tech Stack

- Next.js 16 (App Router) + React 19
- TypeScript (strict mode)
- shadcn/ui + Tailwind CSS 4
- SQLite via better-sqlite3
- whisper.cpp + Ollama

## License

MIT

## Acknowledgments

- [whisper.cpp](https://github.com/ggerganov/whisper.cpp) - Local speech recognition
- [Ollama](https://ollama.ai) - Local LLM inference
- [GPT-OSS](https://ollama.com/library/gpt-oss) - OpenAI's open-weight model
- [shadcn/ui](https://ui.shadcn.com) - UI components
