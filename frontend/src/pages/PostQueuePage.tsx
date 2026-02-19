import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { socialApi, SocialPost } from "@/api/socialApi";
import { useToast } from "@/components/ui/toast";
import { Plus, Send, Copy, Trash2, Edit, Clock, CheckCircle, AlertTriangle, Loader, Instagram, Facebook, Filter } from "lucide-react";
import { format } from "date-fns";

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  draft: { bg: "bg-zinc-500/10", text: "text-zinc-400", icon: Edit },
  scheduled: { bg: "bg-blue-500/10", text: "text-blue-400", icon: Clock },
  publishing: { bg: "bg-amber-500/10", text: "text-amber-400", icon: Loader },
  published: { bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle },
  failed: { bg: "bg-red-500/10", text: "text-red-400", icon: AlertTriangle },
};

export function PostQueuePage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchPosts();
  }, [statusFilter]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await socialApi.getPosts(params);
      setPosts(data.posts);
      setTotal(data.total);
    } catch {
      toast("Failed to load posts", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    try {
      await socialApi.deletePost(id);
      setPosts((prev) => prev.filter((p) => p.id !== id));
      toast("Post deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await socialApi.duplicatePost(id);
      toast("Post duplicated", "success");
      fetchPosts();
    } catch {
      toast("Failed to duplicate", "error");
    }
  };

  const handlePublish = async (id: string) => {
    try {
      await socialApi.publishPost(id);
      toast("Publishing started", "success");
      fetchPosts();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to publish", "error");
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent">
            Post Queue
          </h1>
          <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1">{total} posts</p>
        </div>
        <button
          onClick={() => navigate("/social/compose")}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-xs font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-600/20"
        >
          <Plus className="h-3.5 w-3.5" /> New Post
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-[hsl(var(--th-text-muted))]" />
        {["", "draft", "scheduled", "publishing", "published", "failed"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              statusFilter === s
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))]"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[hsl(var(--th-surface))] animate-pulse" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Send className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-[hsl(var(--th-text))] mb-2">No posts yet</h3>
          <p className="text-sm text-[hsl(var(--th-text-muted))] mb-6">Create your first social media post to get started.</p>
          <button
            onClick={() => navigate("/social/compose")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-600/20"
          >
            <Plus className="h-4 w-4" /> Create Post
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => {
            const statusConfig = STATUS_STYLES[post.status] || STATUS_STYLES.draft;
            const StatusIcon = statusConfig.icon;
            return (
              <div key={post.id} className="flex gap-4 p-4 rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] hover:border-[hsl(var(--th-border))]/80 transition-all">
                {/* Media preview */}
                <div className="h-16 w-16 rounded-lg bg-[hsl(var(--th-input))] shrink-0 overflow-hidden">
                  {post.media && post.media.length > 0 && post.media[0].url ? (
                    <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-[hsl(var(--th-text-muted))]">
                      <Send className="h-6 w-6" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[hsl(var(--th-text))] line-clamp-2 mb-1">
                    {post.caption || <span className="italic text-[hsl(var(--th-text-muted))]">No caption</span>}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig.bg} ${statusConfig.text}`}>
                      <StatusIcon className="h-3 w-3" /> {post.status}
                    </span>
                    <span className="text-[10px] text-[hsl(var(--th-text-muted))] uppercase">{post.post_type}</span>
                    {post.scheduled_at && (
                      <span className="text-[10px] text-[hsl(var(--th-text-muted))]">
                        {format(new Date(post.scheduled_at), "MMM d, yyyy 'at' h:mm a")}
                      </span>
                    )}
                    {post.target_accounts && post.target_accounts.length > 0 && (
                      <div className="flex items-center gap-1">
                        {post.target_accounts.map((a, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-[hsl(var(--th-text-muted))]">
                            {a.account_type === "instagram_business" ? <Instagram className="h-3 w-3 text-pink-400" /> : <Facebook className="h-3 w-3 text-blue-400" />}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {post.error_message && (
                    <p className="text-[10px] text-red-400 mt-1 truncate">{post.error_message}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {(post.status === "draft" || post.status === "scheduled" || post.status === "failed") && (
                    <button
                      onClick={() => navigate(`/social/compose?edit=${post.id}`)}
                      className="p-2 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))] transition-colors"
                      title="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                  )}
                  {(post.status === "draft" || post.status === "scheduled") && (
                    <button
                      onClick={() => handlePublish(post.id)}
                      className="p-2 rounded-lg hover:bg-emerald-500/10 text-[hsl(var(--th-text-muted))] hover:text-emerald-400 transition-colors"
                      title="Publish Now"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDuplicate(post.id)}
                    className="p-2 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))] transition-colors"
                    title="Duplicate"
                  >
                    <Copy className="h-4 w-4" />
                  </button>
                  {post.status !== "publishing" && (
                    <button
                      onClick={() => handleDelete(post.id)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-[hsl(var(--th-text-muted))] hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
