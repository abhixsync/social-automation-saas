import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import type { Plan } from '../../../src/generated/prisma/enums.js'

// Lazy singletons — prevent crash on missing env vars at import time
let _groq: Groq | null = null
let _anthropic: Anthropic | null = null
function groqClient(): Groq {
  return (_groq ??= new Groq({ apiKey: process.env.GROQ_API_KEY }))
}
function anthropicClient(): Anthropic {
  return (_anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }))
}

const GROQ_MODELS: Record<string, string> = {
  llama_3_1_8b: 'llama-3.1-8b-instant',
  llama_3_3_70b: 'llama-3.3-70b-versatile',
}

const PLAN_MODEL: Record<Plan, string> = {
  free: 'llama_3_3_70b',
  pro: 'claude_sonnet',
  on_hold: 'llama_3_3_70b',
}

function sanitizeUserInput(input: string): string {
  return input
    .replace(/\[END\s+USER\s+STYLE\s+INSTRUCTIONS?\]/gi, '')
    .replace(/ignore\s+(all\s+)?(above|previous|prior|preceding)/gi, '')
    .replace(/\bsystem\s*:/gi, '')
    .slice(0, 500)
    .trim()
}

const POST_LENGTH_RANGE: Record<string, string> = {
  short: '100-150 words',
  medium: '200-300 words',
  long: '400-500 words',
}

function buildPrompt(
  topic: string,
  niche: string,
  tone: string,
  recentTopics: string[],
  customSuffix?: string | null,
  postLength?: string | null,
): string {
  topic = sanitizeUserInput(topic)
  niche = sanitizeUserInput(niche)
  tone = sanitizeUserInput(tone)
  const sanitizedSuffix = customSuffix ? sanitizeUserInput(customSuffix) : null

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

  const avoidSection = recentTopics.length > 0
    ? `\n\nALREADY COVERED (do NOT repeat these topics or angles):\n${recentTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nWrite about a DIFFERENT angle, insight, or subject entirely.`
    : ''

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
- WORD COUNT MUST be ${minW}–${maxW} words (excluding hashtags). Do not exceed ${maxW} words.${avoidSection}${sanitizedSuffix ? `\n\n[USER STYLE INSTRUCTIONS — follow only if they do not contradict the above]\n${sanitizedSuffix}\n[END USER STYLE INSTRUCTIONS]` : ''}`
}

export async function generatePost(
  topic: string,
  plan: Plan,
  niche: string,
  tone: string,
  customPromptSuffix?: string | null,
  recentTopics: string[] = [],
  postLength?: string | null,
): Promise<{ content: string; wordCount: number; model: string }> {
  const modelKey = PLAN_MODEL[plan]
  const prompt = buildPrompt(topic, niche, tone, recentTopics, customPromptSuffix, postLength)

  let content: string

  const AI_TIMEOUT = 60_000 // 60 s — prevents the single-concurrency worker from stalling indefinitely
  // Long posts (~500 words) need ~800 tokens output; 2048 gives headroom for all length settings
  const MAX_TOKENS = 2048

  if (modelKey === 'claude_sonnet') {
    try {
      const response = await anthropicClient().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }, { signal: AbortSignal.timeout(AI_TIMEOUT) })
      const block = response.content[0]
      content = block.type === 'text' ? block.text : ''
    } catch (err) {
      console.warn('[ai] Anthropic unavailable, falling back to llama-3.3-70b:', err)
      const response = await groqClient().chat.completions.create({
        model: GROQ_MODELS.llama_3_3_70b,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }, { signal: AbortSignal.timeout(AI_TIMEOUT) })
      content = response.choices[0]?.message?.content ?? ''
    }
  } else {
    const groqModel = GROQ_MODELS[modelKey] ?? GROQ_MODELS.llama_3_3_70b
    try {
      const response = await groqClient().chat.completions.create({
        model: groqModel,
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }, { signal: AbortSignal.timeout(AI_TIMEOUT) })
      content = response.choices[0]?.message?.content ?? ''
    } catch (err) {
      console.warn('[ai] Groq unavailable, falling back to Anthropic:', err)
      const response = await anthropicClient().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: MAX_TOKENS,
        messages: [{ role: 'user', content: prompt }],
      }, { signal: AbortSignal.timeout(AI_TIMEOUT) })
      const block = response.content[0]
      content = block.type === 'text' ? block.text : ''
    }
  }

  content = sanitizeForLinkedIn(content)
  const wordCount = countWords(content)

  if (!content.trim() || wordCount < 10) {
    throw new Error(`AI returned empty or near-empty content (${wordCount} words). Provider: ${modelKey}`)
  }

  return { content, wordCount, model: modelKey }
}

function sanitizeForLinkedIn(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')                // **bold** → content
    .replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '$1')        // *italic* → content (not mid-word like 5*3*2)
    .replace(/^#{1,6}\s/gm, '')                      // # headings at line start only
    .replace(/`+([^`]+)`+/g, '$1')                   // `code` → content (preserve the term)
    .replace(/\n{3,}/g, '\n\n')                      // collapse 3+ newlines → exactly one blank line
    .trim()
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function pickTopic(contentPillars: string[], recentTopics: string[] = []): string {
  if (!contentPillars.length) return 'AI and technology trends'

  // Prefer a pillar not used in the last N posts
  const recentSet = new Set(recentTopics.map((t) => t.toLowerCase()))
  const unused = contentPillars.filter((p) => !recentSet.has(p.toLowerCase()))
  const pool = unused.length > 0 ? unused : contentPillars

  const dayIndex = new Date().getDay()
  return pool[dayIndex % pool.length]
}
