// 1 credit = 50 words
export const WORDS_PER_CREDIT = 50

export const IMAGE_CREDITS = 5
export const AI_IMAGE_CREDITS = 20

export function wordsToCredits(wordCount: number): number {
  return Math.ceil(wordCount / WORDS_PER_CREDIT)
}
