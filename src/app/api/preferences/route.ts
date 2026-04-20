import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/ratelimit'

const updateSchema = z.object({
  niche: z.string().min(1).max(500).optional(),
  tone: z.enum(['professional', 'casual', 'thought_leader', 'storyteller', 'practitioner', 'contrarian', 'builder_in_public', 'educator', 'mentor']).optional(),
  contentPillars: z.array(z.string().min(1).max(200)).max(50).optional(),
  customPromptSuffix: z.string().max(2000).nullable().optional(),
  approvalMode: z.boolean().optional(),
  timezone: z.string().min(1).max(100).optional(),
  imageStyle: z.enum(['quote_card', 'stats_card', 'topic_card', 'minimal_light', 'minimal_dark', 'list_card', 'stock_photo']).optional(),
  autoImage: z.boolean().optional(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #4f46e5').nullable().optional(),
  showProfilePicOnCard: z.boolean().optional(),
  carouselMode: z.boolean().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const prefs = await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    update: {},
    create: {
      userId: session.user.id,
      niche: 'tech professional',
      tone: 'professional',
      contentPillars: [],
      approvalMode: false,
      timezone: 'Asia/Kolkata',
    },
  })

  return NextResponse.json({ preferences: prefs })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed } = await checkRateLimit(`preferences:${session.user.id}`, 10, 60)
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const data = updateSchema.parse(body)

    const prefs = await prisma.userPreferences.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        niche: data.niche ?? 'tech professional',
        tone: data.tone ?? 'professional',
        contentPillars: data.contentPillars ?? [],
        customPromptSuffix: data.customPromptSuffix ?? null,
        approvalMode: data.approvalMode ?? false,
        timezone: data.timezone ?? 'Asia/Kolkata',
        imageStyle: data.imageStyle ?? 'quote_card',
        autoImage: data.autoImage ?? true,
        brandColor: data.brandColor ?? null,
        showProfilePicOnCard: data.showProfilePicOnCard ?? false,
        carouselMode: data.carouselMode ?? false,
      },
    })

    return NextResponse.json({ preferences: prefs })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 })
    }
    console.error('[preferences/PUT]', err)
    return NextResponse.json({ error: 'Failed to update preferences' }, { status: 500 })
  }
}
