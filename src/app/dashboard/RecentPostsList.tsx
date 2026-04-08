'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface RecentPost {
  id: string
  topic: string
  status: string
  creditsUsed: number
  wordCount: number
  createdAt: string
  generatedContent: string
  linkedInAccount: { displayName: string | null }
}

function statusColor(status: string) {
  switch (status) {
    case 'published': return 'bg-green-100 text-green-700'
    case 'pending_approval': return 'bg-yellow-100 text-yellow-700'
    case 'failed': return 'bg-red-100 text-red-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

function statusLabel(status: string) {
  switch (status) {
    case 'pending_approval': return 'Pending'
    case 'published': return 'Published'
    case 'failed': return 'Failed'
    default: return status
  }
}

export default function RecentPostsList({ posts: initial }: { posts: RecentPost[] }) {
  const [posts, setPosts] = useState(initial)
  const [viewPost, setViewPost] = useState<RecentPost | null>(null)
  const [approving, setApproving] = useState<string | null>(null)

  async function handleApprove(post: RecentPost) {
    setApproving(post.id)
    try {
      const res = await fetch(`/api/posts/${post.id}/approve`, { method: 'POST', credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to approve')
      toast.success('Post approved and published to LinkedIn!')
      setPosts((prev) => prev.map((p) => p.id === post.id ? { ...p, status: 'published' } : p))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApproving(null)
    }
  }

  if (posts.length === 0) {
    return (
      <div className="px-6 py-10 text-center text-gray-400 text-sm">
        No posts yet. Connect a LinkedIn account and set up a schedule to get started.
      </div>
    )
  }

  return (
    <>
      <div className="divide-y divide-gray-100">
        {posts.map((post) => (
          <div key={post.id} className="flex items-center justify-between px-6 py-3.5 gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{post.topic}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {post.linkedInAccount.displayName ?? 'LinkedIn'} ·{' '}
                {post.wordCount} words · {post.creditsUsed} credits ·{' '}
                {new Date(post.createdAt).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(post.status)}`}>
                {statusLabel(post.status)}
              </span>
              <Button size="sm" variant="ghost" className="px-2 h-7 text-gray-400 hover:text-indigo-600"
                onClick={() => setViewPost(post)}>
                <Eye className="w-3.5 h-3.5" />
              </Button>
              {post.status === 'pending_approval' && (
                <Button size="sm" onClick={() => handleApprove(post)} disabled={approving === post.id}
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700">
                  {approving === post.id
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <><CheckCircle className="w-3 h-3 mr-1" />Approve</>}
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={!!viewPost} onOpenChange={(open) => !open && setViewPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{viewPost?.topic}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {viewPost?.generatedContent}
          </div>
          <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-100">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(viewPost?.status ?? '')}`}>
              {statusLabel(viewPost?.status ?? '')}
            </span>
            {viewPost?.status === 'pending_approval' && (
              <Button size="sm" onClick={() => { handleApprove(viewPost!); setViewPost(null) }}
                disabled={!!approving}
                className="text-xs bg-indigo-600 hover:bg-indigo-700">
                <CheckCircle className="w-3 h-3 mr-1" />Approve & Publish
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
