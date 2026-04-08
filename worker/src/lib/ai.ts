import Groq from 'groq-sdk'
import Anthropic from '@anthropic-ai/sdk'
import type { Plan } from '../../../src/generated/prisma/enums.js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const GROQ_MODELS: Record<string, string> = {
  llama_3_1_8b: 'llama-3.1-8b-instant',
  llama_3_3_70b: 'llama-3.3-70b-versatile',
}

const PLAN_MODEL: Record<Plan, string> = {
  free: 'llama_3_1_8b',
  starter: 'llama_3_3_70b',
  growth: 'llama_3_3_70b',
  pro: 'claude_sonnet',
}

function buildPrompt(
  topic: string,
  niche: string,
  tone: string,
  customSuffix?: string | null,
): string {
  const toneMap: Record<string, string> = {
    professional: 'professional and authoritative',
    casual: 'conversational and approachable',
    thought_leader: 'visionary and insightful, sharing bold opinions',
    storyteller: 'narrative-driven, using personal anecdotes',
  }
  const toneDesc = toneMap[tone] ?? 'professional'

  return `Write a LinkedIn post for a ${niche} about: ${topic}.

Tone: ${toneDesc}

Structure:
- Hook opening line (compelling, no generic opener)
- 4-5 bullet points with emoji, each point title in ALL CAPS followed by a dash
- Closing question to drive engagement

Length: 200-250 words.
End with 3-5 relevant hashtags on the last line.

CRITICAL: No markdown, no asterisks, no bold/italic formatting. Plain text only. LinkedIn does not render markdown.${customSuffix ? `\n\n${customSuffix}` : ''}`
}

export async function generatePost(
  topic: string,
  plan: Plan,
  niche: string,
  tone: string,
  customPromptSuffix?: string | null,
): Promise<{ content: string; wordCount: number; model: string }> {
  const modelKey = PLAN_MODEL[plan]
  const prompt = buildPrompt(topic, niche, tone, customPromptSuffix)

  let content: string

  if (modelKey === 'claude_sonnet') {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    content = block.type === 'text' ? block.text : ''
  } else {
    const groqModel = GROQ_MODELS[modelKey] ?? GROQ_MODELS.llama_3_3_70b
    const response = await groq.chat.completions.create({
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
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,6}\s/g, '')
    .replace(/`{1,3}[^`]*`{1,3}/g, '')
    .trim()
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function pickTopic(contentPillars: string[]): string {
  if (!contentPillars.length) return 'AI and technology trends'
  const dayIndex = new Date().getDay()
  return contentPillars[dayIndex % contentPillars.length]
}
