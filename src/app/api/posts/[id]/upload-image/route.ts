import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put, del } from '@vercel/blob'

const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const post = await prisma.post.findFirst({
    where: { id, userId: session.user.id, status: 'pending_approval' },
    select: { id: true, customImageUrl: true },
  })
  if (!post) return NextResponse.json({ error: 'Post not found or not editable' }, { status: 404 })

  const formData = await req.formData()
  const file = formData.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image file provided' }, { status: 400 })

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, and WebP images are allowed' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'Image must be under 5 MB' }, { status: 400 })
  }

  // Magic byte validation — verify the file content matches the declared content type
  const headerBytes = await file.slice(0, 12).arrayBuffer()
  const header = new Uint8Array(headerBytes)
  let magicValid = false
  if (file.type === 'image/jpeg') {
    magicValid = header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF
  } else if (file.type === 'image/png') {
    magicValid = header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47
  } else if (file.type === 'image/webp') {
    magicValid = header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
  }
  if (!magicValid) {
    return NextResponse.json({ error: 'File content does not match declared image type' }, { status: 400 })
  }

  // Delete previous custom image if one exists
  if (post.customImageUrl) {
    try { await del(post.customImageUrl) } catch { /* blob may already be gone */ }
  }

  const blob = await put(`post-images/${id}-${Date.now()}.${file.type.split('/')[1]}`, file, {
    access: 'public',
    contentType: file.type,
  })

  await prisma.post.update({
    where: { id },
    data: { customImageUrl: blob.url },
  })

  return NextResponse.json({ url: blob.url })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const post = await prisma.post.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, customImageUrl: true },
  })
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  if (post.customImageUrl) {
    try { await del(post.customImageUrl) } catch { /* blob may already be gone */ }
    await prisma.post.update({
      where: { id },
      data: { customImageUrl: null },
    })
  }

  return NextResponse.json({ message: 'Custom image removed' })
}
