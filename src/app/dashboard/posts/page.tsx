'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RefreshCw, Trash2, CheckCircle, ChevronLeft, ChevronRight, Loader2, Eye } from 'lucide-react'

interface Post {
  id: string
  topic: string
  generatedContent: string
  wordCount: number
  creditsUsed: number
  status: string
  aiModel: string
  createdAt: string
  publishedAt: string | null
  linkedInAccount: { displayName: string | null; profilePicture: string | null }
}

interface PostsResponse {
  posts: Post[]
  total: number
  page: number
  totalPages: number
}

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
]

function statusBadge(status: string) {
  switch (status) {
    case 'published':
      return <Badge className="bg-green-100 text-green-700 border-0 hover:bg-green-100">Published</Badge>
    case 'pending_approval':
      return <Badge className="bg-yellow-100 text-yellow-700 border-0 hover:bg-yellow-100">Pending</Badge>
    case 'failed':
      return <Badge className="bg-red-100 text-red-700 border-0 hover:bg-red-100">Failed</Badge>
    case 'approved':
      return <Badge className="bg-blue-100 text-blue-700 border-0 hover:bg-blue-100">Approved</Badge>
    default:
      return <Badge variant="secondary">{status}</Badge>
  }
}

function truncate(text: string, max = 160) {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function PostsPage() {
  const [activeTab, setActiveTab] = useState('all')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<PostsResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({})
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null)
  const [viewPost, setViewPost] = useState<Post | null>(null)

  const fetchPosts = useCallback(async (status: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: '20' })
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/posts?${params}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to fetch posts')
      const json = await res.json()
      setData(json)
    } catch {
      toast.error('Failed to load posts')
    } finally {
      setLoading(false)
    }
  }, [])

  // Single effect: fires when page or tab changes. Tab change resets page (below),
  // which triggers this effect — avoids the double-fetch race condition.
  useEffect(() => {
    fetchPosts(activeTab, page)
  }, [page, activeTab, fetchPosts])

  function changeTab(tab: string) {
    setActiveTab(tab)
    setPage(1)
  }

  async function handleApprove(post: Post) {
    setActionLoading((p) => ({ ...p, [post.id]: 'approve' }))
    try {
      const res = await fetch(`/api/posts/${post.id}/approve`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to approve')
      toast.success('Post approved and published to LinkedIn')
      fetchPosts(activeTab, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve post')
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[post.id]; return n })
    }
  }

  async function handleRegenerate(post: Post) {
    setActionLoading((p) => ({ ...p, [post.id]: 'regenerate' }))
    try {
      const res = await fetch(`/api/posts/${post.id}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to regenerate')
      toast.success('Post regenerated successfully')
      fetchPosts(activeTab, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate post')
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[post.id]; return n })
    }
  }

  async function handleDelete(post: Post) {
    setActionLoading((p) => ({ ...p, [post.id]: 'delete' }))
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete')
      toast.success('Post deleted')
      setDeleteTarget(null)
      fetchPosts(activeTab, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete post')
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[post.id]; return n })
    }
  }

  const posts = data?.posts ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Posts</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your AI-generated LinkedIn posts</p>
      </div>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="mb-6">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {STATUS_TABS.map((t) => (
          <TabsContent key={t.value} value={t.value}>
            {loading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20 text-gray-400 text-sm">
                No posts found.
              </div>
            ) : (
              <div className="space-y-3">
                {posts.map((post) => {
                  const busy = actionLoading[post.id]
                  return (
                    <div
                      key={post.id}
                      className="bg-white rounded-xl border border-gray-200 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            {statusBadge(post.status)}
                            <span className="text-xs text-gray-400">
                              {post.linkedInAccount.displayName ?? 'LinkedIn'}
                            </span>
                            <span className="text-xs text-gray-400">·</span>
                            <span className="text-xs text-gray-400">
                              {new Date(post.createdAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900 mb-1">{post.topic}</p>
                          <p className="text-sm text-gray-600 leading-relaxed">
                            {truncate(post.generatedContent)}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-400">
                            <span>{post.wordCount} words</span>
                            <span>{post.creditsUsed} credits</span>
                            {post.publishedAt && (
                              <span>
                                Published{' '}
                                {new Date(post.publishedAt!).toLocaleString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setViewPost(post)}
                            className="px-2 text-gray-400 hover:text-indigo-600"
                            title="View full post"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {post.status === 'pending_approval' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRegenerate(post)}
                                disabled={!!busy}
                                className="text-xs"
                              >
                                {busy === 'regenerate' ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <RefreshCw className="w-3 h-3 mr-1" />
                                )}
                                Regenerate
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApprove(post)}
                                disabled={!!busy}
                                className="bg-indigo-600 hover:bg-indigo-700 text-xs"
                              >
                                {busy === 'approve' ? (
                                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                )}
                                Approve
                              </Button>
                            </>
                          )}
                          {post.status !== 'published' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTarget(post)}
                              disabled={!!busy}
                              className="text-gray-400 hover:text-red-500 hover:bg-red-50 px-2"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6">
                <p className="text-sm text-gray-500">
                  Page {data?.page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* View full post dialog */}
      <Dialog open={!!viewPost} onOpenChange={(open) => !open && setViewPost(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base">{viewPost?.topic}</DialogTitle>
            <DialogDescription>
              {viewPost ? new Date(viewPost.createdAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }) : ''} · {viewPost?.wordCount} words · {viewPost?.creditsUsed} credits
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto">
            {viewPost?.generatedContent}
          </div>
          {viewPost?.status === 'pending_approval' && (
            <DialogFooter>
              <Button
                onClick={() => { handleApprove(viewPost!); setViewPost(null) }}
                disabled={!!actionLoading[viewPost?.id ?? '']}
                className="bg-indigo-600 hover:bg-indigo-700 text-sm"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                Approve & Publish
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Post</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deleteTarget?.topic}&quot;? This action cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={!!deleteTarget && !!actionLoading[deleteTarget.id]}
            >
              {deleteTarget && actionLoading[deleteTarget.id] === 'delete' ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
