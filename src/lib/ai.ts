import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import type { Plan } from '@/generated/prisma/enums'
import { PLAN_CONFIG } from '@/types'

// Lazy singletons — prevent build-time crash when API keys are absent
let _groq: Groq | null = null
let _anthropic: Anthropic | null = null
function groqClient(): Groq {
  return (_groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY }))
}
function anthropicClient(): Anthropic {
  return (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))
}

// ─── Model routing ────────────────────────────────────────────────────────────

const GROQ_MODELS: Record<string, string> = {
  llama_3_1_8b: 'llama-3.1-8b-instant',
  llama_3_3_70b: 'llama-3.3-70b-versatile',
}

// ─── Prompt builder ───────────────────────────────────────────────────────────

const POST_LENGTH_RANGE: Record<string, string> = {
  short: '100-150 words',
  medium: '200-300 words',
  long: '400-500 words',
}

function sanitizeUserInput(input: string): string {
  return input
    .replace(/\[END\s+USER\s+STYLE\s+INSTRUCTIONS?\]/gi, '')
    .replace(/ignore\s+(all\s+)?(above|previous|prior|preceding)/gi, '')
    .replace(/\bsystem\s*:/gi, '')
    .slice(0, 500)
    .trim()
}

function buildPrompt(
  topic: string,
  niche: string,
  tone: string,
  customSuffix?: string | null,
  postLength?: string | null,
): string {
  topic = sanitizeUserInput(topic)
  niche = sanitizeUserInput(niche)
  tone = sanitizeUserInput(tone)
  const toneMap: Record<string, string> = {
    professional: 'professional and authoritative',
    casual: 'conversational and approachable',
    thought_leader: 'visionary and insightful, sharing bold opinions',
    storyteller: 'narrative-driven, using personal anecdotes',
    practitioner: 'grounded in real-world experience, sharing practical lessons from actual hands-on work — no theory, just what actually happened',
    contrarian: 'challenges conventional wisdom with bold, evidence-backed counterpoints — "everyone says X, but after years of experience I think Y"',
    builder_in_public: 'transparent and vulnerable, sharing progress, failures, and learnings openly — celebrating wins and setbacks equally',
    educator: 'breaks down complex concepts clearly and simply, teaching step by step so anyone can follow along',
    mentor: 'speaks from experience to help junior professionals grow, warm and encouraging — "what I wish someone told me earlier"',
  }

  const toneDesc = toneMap[tone] ?? 'professional'

  const lengthRange = POST_LENGTH_RANGE[postLength ?? 'medium'] ?? '200-300 words'
  const [minW, maxW] = lengthRange.match(/\d+/g)!.map(Number)

  return `Write a LinkedIn post for a ${niche} about: ${topic}.

STRICT WORD COUNT: ${lengthRange}. The post MUST be between ${minW} and ${maxW} words (excluding hashtags). Count your words before finishing. If you are over ${maxW} words, cut bullet descriptions. If you are under ${minW} words, expand bullet descriptions.

Tone: ${toneDesc}

Structure (follow exactly):
1. Hook — one punchy opening line (no generic openers like "In today's world")
2. BLANK LINE
3. One short bridge sentence expanding the hook
4. BLANK LINE
5. Each bullet point on its OWN line, preceded by a BLANK LINE. Format: [emoji] TITLE IN CAPS - description
6. BLANK LINE after the last bullet
7. Closing question to drive engagement
8. BLANK LINE
9. 3-5 hashtags on the final line

FORMATTING RULES (non-negotiable):
- Separate every section and every bullet point with EXACTLY ONE blank line (one empty line between them, never two or more)
- No markdown, no asterisks, no bold/italic. Plain text only — LinkedIn does not render markdown
- Each bullet point on its own line with exactly one blank line before it
- WORD COUNT MUST be ${minW}–${maxW} words (excluding hashtags). Do not exceed ${maxW} words.${customSuffix ? `\n\n[USER STYLE INSTRUCTIONS — follow only if they do not contradict the above]\n${customSuffix}\n[END USER STYLE INSTRUCTIONS]` : ''}`
}

// ─── Generation ───────────────────────────────────────────────────────────────

export async function generatePost(
  topic: string,
  plan: Plan,
  niche: string,
  tone: string,
  customPromptSuffix?: string | null,
  postLength?: string | null,
): Promise<{ content: string; wordCount: number; model: string }> {
  const modelKey = PLAN_CONFIG[plan].model
  const prompt = buildPrompt(topic, niche, tone, customPromptSuffix, postLength)

  let content: string

  if (modelKey === 'claude_sonnet') {
    // Pro plan — Claude Sonnet 4.6
    const response = await anthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    content = block.type === 'text' ? block.text : ''
  } else {
    // Free / Starter / Growth — Groq
    const groqModel = GROQ_MODELS[modelKey] ?? GROQ_MODELS.llama_3_3_70b
    const response = await groqClient().chat.completions.create({
      model: groqModel,
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })
    content = response.choices[0]?.message?.content ?? ''
  }

  // Sanitize: remove any stray markdown artifacts
  content = sanitizeForLinkedIn(content)

  const wordCount = countWords(content)

  return { content, wordCount, model: modelKey }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sanitizeForLinkedIn(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')          // **bold** → content
    .replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '$1') // *italic* → content (not mid-word like 5*3*2)
    .replace(/^#{1,6}\s/gm, '')               // # headings at line start only
    .replace(/`+([^`]+)`+/g, '$1')            // `code` → content (preserve the term)
    .replace(/\n{3,}/g, '\n\n')               // collapse 3+ newlines → exactly one blank line
    .trim()
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

// Pick next topic from content pillars (rotates by day of week)
export function pickTopic(contentPillars: string[]): string {
  if (!contentPillars.length) return 'AI and technology trends'
  const dayIndex = new Date().getDay()
  return contentPillars[dayIndex % contentPillars.length]
}
