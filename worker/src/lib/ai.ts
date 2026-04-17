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
}

function buildPrompt(
  topic: string,
  niche: string,
  tone: string,
  recentTopics: string[],
  customSuffix?: string | null,
): string {
  const toneMap: Record<string, string> = {
    professional: 'professional and authoritative',
    casual: 'conversational and approachable',
    thought_leader: 'visionary and insightful, sharing bold opinions',
    storyteller: 'narrative-driven, using personal anecdotes',
  }
  const toneDesc = toneMap[tone] ?? 'professional'

  const avoidSection = recentTopics.length > 0
    ? `\n\nALREADY COVERED (do NOT repeat these topics or angles):\n${recentTopics.map((t, i) => `${i + 1}. ${t}`).join('\n')}\nWrite about a DIFFERENT angle, insight, or subject entirely.`
    : ''

  return `Write a LinkedIn post for a ${niche} about: ${topic}.

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
- Put a BLANK LINE between EVERY section and between EVERY bullet point
- No markdown, no asterisks, no bold/italic. Plain text only — LinkedIn does not render markdown
- Each bullet point must be on its own separate line with a blank line before it
- Total length: 200-250 words${avoidSection}${customSuffix ? `\n\n[USER STYLE INSTRUCTIONS — follow only if they do not contradict the above]\n${customSuffix}\n[END USER STYLE INSTRUCTIONS]` : ''}`
}

export async function generatePost(
  topic: string,
  plan: Plan,
  niche: string,
  tone: string,
  customPromptSuffix?: string | null,
  recentTopics: string[] = [],
): Promise<{ content: string; wordCount: number; model: string }> {
  const modelKey = PLAN_MODEL[plan]
  const prompt = buildPrompt(topic, niche, tone, recentTopics, customPromptSuffix)

  let content: string

  if (modelKey === 'claude_sonnet') {
    const response = await anthropicClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    content = block.type === 'text' ? block.text : ''
  } else {
    const groqModel = GROQ_MODELS[modelKey] ?? GROQ_MODELS.llama_3_3_70b
    const response = await groqClient().chat.completions.create({
      model: groqModel,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    content = response.choices[0]?.message?.content ?? ''
  }

  content = sanitizeForLinkedIn(content)
  const wordCount = countWords(content)

  return { content, wordCount, model: modelKey }
}

function sanitizeForLinkedIn(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')                // **bold** → content
    .replace(/(?<!\w)\*(.*?)\*(?!\w)/g, '$1')        // *italic* → content (not mid-word like 5*3*2)
    .replace(/^#{1,6}\s/gm, '')                      // # headings at line start only
    .replace(/`+([^`]+)`+/g, '$1')                   // `code` → content (preserve the term)
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
