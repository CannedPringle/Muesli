import { getAllSettings } from '@/lib/db';
import type { PromptAnswers, EntryType } from '@/types';

interface OllamaResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

/**
 * Call Ollama generate API
 */
async function ollamaGenerate(prompt: string): Promise<string> {
  const settings = getAllSettings();
  const baseUrl = settings.ollamaBaseUrl;
  const model = settings.ollamaModel;

  const request: OllamaGenerateRequest = {
    model,
    prompt,
    stream: false,
    options: {
      temperature: 0.7,
      num_predict: 4096,
    },
  };

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama API error (${response.status}): ${error}`);
  }

  const data = (await response.json()) as OllamaResponse;
  return data.response;
}

/**
 * Build the Daily Strategic Journal prompt
 */
function buildDailyStrategicJournalPrompt(transcript: string, userName: string): string {
  const nameText = userName ? `for ${userName}` : '';
  const name = userName || 'User';
  
  return `You are an assistant that formats raw voice transcripts into a **Daily Strategic Journal**${nameText ? ` ${nameText}` : ''}.

Your job is NOT to write creatively.  
Your job is to **extract facts, identify leverage, and expose trajectory**.

Rules:
- Do NOT invent facts.
- If something is unclear, state it as unknown.
- Do NOT add advice unless explicitly requested.
- Use the exact section headings below.
- Keep language concise and concrete.
- Prefer bullet points over paragraphs.
- Quote ${name}'s own words when important.

You will be given:
- A raw transcript (verbatim speech)

---

Produce exactly the following sections in this order:

---

## ${name} – Daily Strategic Journal

### 0) ${name}'s TL;DR (First-Person)
Write a 5–8 sentence first-person summary as if ${name} wrote it himself.  
It should include what happened, how he felt, and what he's thinking about.  
Do not add new facts.

---

### 1) Today in 6 Bullets (Objective)
List the six most important factual events or actions from today.  
No emotions. No interpretation.

---

### 2) What Actually Mattered
From everything today, list what had real long-term leverage on:
- ${name}'s startup
- Money
- Skills
- Reputation
- Relationships  
Only include items that compound.

---

### 3) Distractions vs Leverage

**Leverage**
- Actions that move ${name} toward building a real company, financial independence, or personal strength.

**Distractions**
- Busywork, avoidance, dopamine traps, or actions that did not compound.

---

### 4) Decisions Made (and Avoided)
List:
- Any real decisions ${name} made today.
- Any important decisions ${name} avoided or postponed.

---

### 5) Friction Points
What slowed ${name} down today?  
List blockers, confusion, emotional resistance, or external obstacles.

---

### 6) Emotional State (Brief)
Summarize ${name}'s emotional and energy state in 2–4 sentences.  
Do not psychoanalyze.

---

### 7) Money & Leverage
List:
- Money earned, spent, or discussed.
- Progress or setbacks toward:
  - savings  
  - car goal  
  - moving out  
  - equity  
If not mentioned, say "Not mentioned."

---

### 8) If Today Repeats for 90 Days…
Predict what ${name}'s life would look like in 90 days if he lived exactly like today.  
Base this only on today's actions and patterns.

---

### 8b) If I Keep Living Like This…
Write a 4–8 sentence first-person reflection describing who ${name} is becoming if he continues this pattern long-term.  
Focus on identity, lifestyle, and trajectory.  
Do not invent facts — extrapolate only from today's actions and patterns.

---

### 9) Tomorrow: 3 Non-Negotiables
From all information, select the three actions that would make tomorrow a win.  
These must be high-leverage, not a long to-do list.

---

### 10) Open Loops
List unresolved tasks, follow-ups, risks, or pending decisions.

---

### 11) Identity Check
Is today aligned with the man ${name} is trying to become:
- disciplined  
- founder  
- operator  
- high-leverage  
Answer in 1–2 sentences.

---

### 12) Tags
Output 3–8 tags starting with \`#\` based on the content (e.g. \`#startup\`, \`#money\`, \`#health\`, \`#distraction\`, \`#leverage\`, \`#relationships\`).

---

Do not output anything outside this format.

---

Raw Transcript:
"""
${transcript}
"""`;
}

/**
 * Generate a formatted journal entry
 * For brain-dump: uses Daily Strategic Journal format
 * For daily-reflection: uses legacy format (kept for backward compat)
 * For quick-note: returns empty (no AI processing)
 */
export async function generateJournal(
  transcript: string,
  promptAnswers: PromptAnswers,
  entryType: EntryType
): Promise<{ reflection: string; summary?: string; content?: string }> {
  const settings = getAllSettings();
  const userName = settings.userName || '';
  
  // Quick-note: no AI generation
  if (entryType === 'quick-note') {
    return { reflection: '', content: '' };
  }
  
  // Brain-dump: use new Daily Strategic Journal format
  if (entryType === 'brain-dump') {
    const prompt = buildDailyStrategicJournalPrompt(transcript, userName);
    const content = await ollamaGenerate(prompt);
    return { reflection: '', content: content.trim() };
  }
  
  // Daily-reflection: use legacy format (unchanged for now)
  // Build context from prompt answers
  const sections: string[] = [];
  
  if (promptAnswers.gratitude?.text) {
    sections.push(`Gratitude:\n${promptAnswers.gratitude.text}`);
  }
  if (promptAnswers.accomplishments?.text) {
    sections.push(`Accomplishments:\n${promptAnswers.accomplishments.text}`);
  }
  if (promptAnswers.challenges?.text) {
    sections.push(`Challenges:\n${promptAnswers.challenges.text}`);
  }
  if (promptAnswers.tomorrow?.text) {
    sections.push(`Tomorrow's Focus:\n${promptAnswers.tomorrow.text}`);
  }

  const contextStr = sections.length > 0 ? sections.join('\n\n') : 'No structured content provided.';

  const prompt = `You are helping write a personal journal reflection. Based on the transcript and structured notes below, write a thoughtful reflection paragraph (2-4 sentences) that captures the essence of this journal entry.

This is a daily reflection with structured prompts.

Original Transcript:
"""
${transcript}
"""

Structured Notes:
${contextStr}

Write a reflection that:
- Is written in first person (as if the journal author wrote it)
- Captures the main themes and emotions
- Is introspective but not overly flowery
- Feels natural and authentic

Respond with ONLY the reflection paragraph, no headers or other text.`;

  const reflection = await ollamaGenerate(prompt);
  
  return {
    reflection: reflection.trim(),
  };
}

/**
 * Generate a title for the journal entry
 */
export async function generateTitle(transcript: string, entryType: EntryType): Promise<string> {
  const prompt = `Based on this journal transcript, suggest a very brief title (3-6 words) that captures the main theme or topic.

Transcript:
"""
${transcript.slice(0, 500)}${transcript.length > 500 ? '...' : ''}
"""

Entry type: ${entryType}

Respond with ONLY the title, no quotes or other text.`;

  const title = await ollamaGenerate(prompt);
  return title.trim().replace(/^["']|["']$/g, ''); // Remove any quotes
}

/**
 * Check if Ollama is running and model is available
 */

// Recommended models (in priority order)
const RECOMMENDED_MODELS = ['gpt-oss:20b', 'qwen3:8b'];

export async function checkOllama(): Promise<{
  running: boolean;
  modelAvailable: boolean;
  modelName: string;
  foundModel?: string;
  error?: string;
}> {
  const settings = getAllSettings();
  const baseUrl = settings.ollamaBaseUrl;
  const modelName = settings.ollamaModel;

  // Check if Ollama is running
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
    });

    if (!response.ok) {
      return {
        running: false,
        modelAvailable: false,
        modelName,
        error: 'Ollama is not responding. Make sure Ollama is running.',
      };
    }

    const data = (await response.json()) as { models: Array<{ name: string }> };
    const models = data.models || [];
    
    // Check if the configured model is available
    const configuredAvailable = models.some(m => 
      m.name === modelName || m.name.startsWith(modelName.split(':')[0])
    );

    // Check if any recommended model is available
    const foundRecommended = RECOMMENDED_MODELS.find(rec =>
      models.some(m => m.name === rec || m.name.startsWith(rec.split(':')[0]))
    );

    const modelAvailable = configuredAvailable || !!foundRecommended;
    const foundModel = configuredAvailable ? modelName : foundRecommended;

    return {
      running: true,
      modelAvailable,
      modelName,
      foundModel,
      error: modelAvailable 
        ? undefined 
        : `No compatible model found. Install with: ollama pull gpt-oss:20b`,
    };
  } catch (err) {
    return {
      running: false,
      modelAvailable: false,
      modelName,
      error: `Cannot connect to Ollama at ${baseUrl}. Make sure Ollama is running.`,
    };
  }
}
