'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { RefreshCw, Trash2, CheckCircle, ChevronLeft, ChevronRight, Loader2, Eye, Pencil, Zap, ImageIcon, Upload, X } from 'lucide-react'
import { Switch } from '@/components/ui/switch'

interface Post {
  id: string
  topic: string
  generatedContent: string
  wordCount: number
  creditsUsed: number
  status: string
  aiModel: string
  includeImage: boolean
  customImageUrl: string | null
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

interface LinkedInAccount {
  id: string
  displayName: string | null
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

  // Edit mode state (inside view dialog)
  const [editMode, setEditMode] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Per-post includeImage optimistic state: postId -> boolean
  const [imageOverrides, setImageOverrides] = useState<Record<string, boolean>>({})
  const [imageToggleLoading, setImageToggleLoading] = useState<Record<string, boolean>>({})

  // Custom image upload state: postId -> uploading
  const [uploadLoading, setUploadLoading] = useState<Record<string, boolean>>({})
  // Track custom image URLs locally for optimistic UI (postId -> url | null)
  const [customImageUrls, setCustomImageUrls] = useState<Record<string, string | null>>({})

  // Generate Now state
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [generateAccounts, setGenerateAccounts] = useState<LinkedInAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [generateLoading, setGenerateLoading] = useState(false)

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

  function openViewPost(post: Post) {
    setViewPost(post)
    setEditMode(false)
    setEditContent(post.generatedContent)
  }

  function closeViewPost() {
    setViewPost(null)
    setEditMode(false)
    setEditContent('')
  }

  async function handleSaveEdit() {
    if (!viewPost) return
    setEditLoading(true)
    try {
      const res = await fetch(`/api/posts/${viewPost.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedContent: editContent }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to save')
      toast.success('Post updated')
      setViewPost({ ...viewPost, generatedContent: editContent, wordCount: json.post.wordCount })
      setEditMode(false)
      fetchPosts(activeTab, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setEditLoading(false)
    }
  }

  async function handleApprove(post: Post) {
    setActionLoading((p) => ({ ...p, [post.id]: 'approve' }))
    const toastId = toast.loading('Publishing to LinkedIn…')
    try {
      const res = await fetch(`/api/posts/${post.id}/approve`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to approve')
      toast.success('Post published to LinkedIn', { id: toastId })
      fetchPosts(activeTab, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to approve post', { id: toastId })
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[post.id]; return n })
    }
  }

  async function handleRegenerate(post: Post) {
    setActionLoading((p) => ({ ...p, [post.id]: 'regenerate' }))
    const toastId = toast.loading('Generating with AI…')
    try {
      const res = await fetch(`/api/posts/${post.id}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to regenerate')
      toast.success('Post regenerated successfully', { id: toastId })
      fetchPosts(activeTab, page)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to regenerate post', { id: toastId })
    } finally {
      setActionLoading((p) => { const n = { ...p }; delete n[post.id]; return n })
    }
  }

  async function handleToggleImage(post: Post, newValue: boolean) {
    const prev = imageOverrides[post.id] ?? post.includeImage
    setImageOverrides((o) => ({ ...o, [post.id]: newValue }))
    setImageToggleLoading((l) => ({ ...l, [post.id]: true }))
    try {
      const res = await fetch(`/api/posts/${post.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ includeImage: newValue }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to update')
    } catch (err) {
      setImageOverrides((o) => ({ ...o, [post.id]: prev }))
      toast.error(err instanceof Error ? err.message : 'Failed to update image setting')
    } finally {
      setImageToggleLoading((l) => { const n = { ...l }; delete n[post.id]; return n })
    }
  }

  async function handleUploadImage(post: Post, file: File) {
    setUploadLoading((l) => ({ ...l, [post.id]: true }))
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch(`/api/posts/${post.id}/upload-image`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')
      setCustomImageUrls((u) => ({ ...u, [post.id]: json.url }))
      toast.success('Image uploaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setUploadLoading((l) => { const n = { ...l }; delete n[post.id]; return n })
    }
  }

  async function handleRemoveCustomImage(post: Post) {
    setUploadLoading((l) => ({ ...l, [post.id]: true }))
    try {
      const res = await fetch(`/api/posts/${post.id}/upload-image`, {
        method: 'DELETE',
        credentials: 'include',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to remove')
      setCustomImageUrls((u) => ({ ...u, [post.id]: null }))
      toast.success('Custom image removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove image')
    } finally {
      setUploadLoading((l) => { const n = { ...l }; delete n[post.id]; return n })
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

  // Generate Now: fetch accounts lazily, queue directly if only one
  async function handleGenerateNow() {
    setGenerateLoading(true)
    try {
      const res = await fetch('/api/linkedin/accounts', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to load accounts')
      const accounts: LinkedInAccount[] = json.accounts ?? []
      if (accounts.length === 0) {
        toast.error('Connect a LinkedIn account first')
        return
      }
      if (accounts.length === 1) {
        await queueGenerate(accounts[0].id)
      } else {
        setGenerateAccounts(accounts)
        setSelectedAccountId(accounts[0].id)
        setShowGenerateDialog(true)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start generation')
    } finally {
      setGenerateLoading(false)
    }
  }

  async function queueGenerate(accountId: string) {
    setGenerateLoading(true)
    const toastId = toast.loading('Queuing post generation…')
    try {
      const res = await fetch('/api/posts/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Failed to queue')
      toast.success('Post queued — check back in a minute', { id: toastId })
      setShowGenerateDialog(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to queue post', { id: toastId })
    } finally {
      setGenerateLoading(false)
    }
  }

  const posts = data?.posts ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Posts</h2>
          <p className="text-sm text-gray-500 mt-1">Manage your AI-generated LinkedIn posts</p>
        </div>
        <Button
          onClick={handleGenerateNow}
          disabled={generateLoading}
          className="bg-indigo-600 hover:bg-indigo-700 flex-shrink-0"
        >
          {generateLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          Generate Now
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={changeTab}>
        <TabsList className="mb-6 flex-nowrap overflow-x-auto w-full sm:w-auto">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="shrink-0">
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
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
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
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                            {truncate(post.generatedContent)}
                          </p>
                          <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                            <span>{post.wordCount} words</span>
                            <span>{post.creditsUsed} credits</span>
                            {post.includeImage && (
                              <span className="flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                image
                              </span>
                            )}
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
                          {post.status === 'pending_approval' && (
                            <div className="mt-3 space-y-3">
                              <div className="flex items-center gap-2">
                                <ImageIcon className={`w-3.5 h-3.5 ${imageToggleLoading[post.id] ? 'text-gray-300' : 'text-gray-400'}`} />
                                <span className="text-xs text-gray-500">Include image</span>
                                <Switch
                                  size="sm"
                                  checked={imageOverrides[post.id] ?? post.includeImage}
                                  onCheckedChange={(checked) => handleToggleImage(post, checked)}
                                  disabled={imageToggleLoading[post.id] ?? false}
                                  className="ml-1"
                                />
                                {imageToggleLoading[post.id] && (
                                  <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
                                )}
                              </div>
                              {(imageOverrides[post.id] ?? post.includeImage) && (() => {
                                const customUrl = customImageUrls[post.id] ?? post.customImageUrl
                                return (
                                  <div className="flex items-end gap-3">
                                    <div className="relative w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                                      <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center">
                                        <ImageIcon className="w-7 h-7 text-white/60" />
                                      </div>
                                      <img
                                        src={customUrl ?? `/api/posts/${post.id}/image`}
                                        alt="Post image preview"
                                        loading="lazy"
                                        className="absolute inset-0 w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                      />
                                      {customUrl && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveCustomImage(post)}
                                          disabled={uploadLoading[post.id]}
                                          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center hover:bg-black/70"
                                          title="Remove custom image"
                                        >
                                          <X className="w-3 h-3 text-white" />
                                        </button>
                                      )}
                                    </div>
                                    <label className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer">
                                      {uploadLoading[post.id] ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Upload className="w-3.5 h-3.5" />
                                      )}
                                      {customUrl ? 'Replace' : 'Upload'}
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        disabled={uploadLoading[post.id]}
                                        onChange={(e) => {
                                          const f = e.target.files?.[0]
                                          if (f) handleUploadImage(post, f)
                                          e.target.value = ''
                                        }}
                                      />
                                    </label>
                                    {customUrl && (
                                      <span className="text-xs text-green-600 font-medium">Custom</span>
                                    )}
                                  </div>
                                )
                              })()}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap sm:flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openViewPost(post)}
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

      {/* View / Edit full post dialog */}
      <Dialog open={!!viewPost} onOpenChange={(open) => !open && closeViewPost()}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{viewPost?.topic}</DialogTitle>
            <DialogDescription>
              {viewPost ? new Date(viewPost.createdAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              }) : ''} · {viewPost?.wordCount} words · {viewPost?.creditsUsed} credits
            </DialogDescription>
          </DialogHeader>

          {editMode ? (
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-64 text-sm leading-relaxed resize-none"
              maxLength={5000}
            />
          ) : (
            <div className="overflow-y-auto max-h-[60vh]">
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {viewPost?.generatedContent}
              </div>
              {viewPost?.status === 'pending_approval' && (imageOverrides[viewPost.id] ?? viewPost.includeImage) && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-xs text-gray-500 font-medium mb-3">Image Preview</p>
                  <div className="relative w-64 h-64 mx-auto rounded-xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-500 flex flex-col items-center justify-center gap-2">
                      <ImageIcon className="w-10 h-10 text-white/60" />
                      <span className="text-white/50 text-xs">Generating…</span>
                    </div>
                    <img
                      src={`/api/posts/${viewPost.id}/image`}
                      alt="LinkedIn post image"
                      loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            {editMode ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => { setEditMode(false); setEditContent(viewPost?.generatedContent ?? '') }}
                  disabled={editLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={editLoading || editContent.trim().length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {editLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Save changes
                </Button>
              </>
            ) : (
              viewPost?.status === 'pending_approval' && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setEditMode(true)}
                    className="text-sm"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => { handleApprove(viewPost!); closeViewPost() }}
                    disabled={!!actionLoading[viewPost?.id ?? '']}
                    className="bg-indigo-600 hover:bg-indigo-700 text-sm"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve & Publish
                  </Button>
                </>
              )
            )}
          </DialogFooter>
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

      {/* Generate Now — account selector (shown only when user has multiple accounts) */}
      <Dialog open={showGenerateDialog} onOpenChange={(open) => !open && setShowGenerateDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Post Now</DialogTitle>
            <DialogDescription>
              Choose which LinkedIn account to generate a post for.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="account-select">LinkedIn account</Label>
            <Select value={selectedAccountId} onValueChange={(v) => v && setSelectedAccountId(v)}>
              <SelectTrigger id="account-select">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {generateAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.displayName ?? a.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)} disabled={generateLoading}>
              Cancel
            </Button>
            <Button
              onClick={() => queueGenerate(selectedAccountId)}
              disabled={!selectedAccountId || generateLoading}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {generateLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
