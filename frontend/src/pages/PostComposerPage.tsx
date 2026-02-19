import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { socialApi, SocialAccount } from "@/api/socialApi";
import { useToast } from "@/components/ui/toast";
import { Send, Clock, Image, Film, Hash, Instagram, Facebook, X, Plus, Layers } from "lucide-react";

const POST_TYPES = [
  { id: "image", label: "Image", icon: Image },
  { id: "video", label: "Video", icon: Film },
  { id: "carousel", label: "Carousel", icon: Layers },
  { id: "reel", label: "Reel", icon: Film },
  { id: "text", label: "Text Only", icon: Hash },
];

export function PostComposerPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [postType, setPostType] = useState("image");
  const [scheduledAt, setScheduledAt] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  useEffect(() => {
    loadAccounts();
    if (editId) loadPost(editId);
  }, [editId]);

  const loadAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const data = await socialApi.getAccounts();
      setAccounts(data.accounts.filter((a) => a.is_active));
    } catch {
      toast("Failed to load accounts", "error");
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadPost = async (id: string) => {
    try {
      const post = await socialApi.getPost(id);
      setCaption(post.caption);
      setHashtags(post.hashtags);
      setPostType(post.post_type);
      setScheduledAt(post.scheduled_at ? post.scheduled_at.slice(0, 16) : "");
      if (post.media && post.media.length > 0) {
        setMediaUrls(post.media.map((m) => m.url));
      }
      if (post.target_accounts && post.target_accounts.length > 0) {
        setSelectedAccounts(post.target_accounts.map((a) => a.social_account_id));
      }
    } catch {
      toast("Failed to load post", "error");
    }
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  const handleAddMediaUrl = () => {
    setMediaUrls((prev) => [...prev, ""]);
  };

  const handleRemoveMediaUrl = (index: number) => {
    setMediaUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMediaUrlChange = (index: number, value: string) => {
    setMediaUrls((prev) => prev.map((url, i) => (i === index ? value : url)));
  };

  const handleSave = async (publish = false) => {
    if (!caption.trim() && postType !== "text") {
      toast("Caption is required", "error");
      return;
    }
    if (selectedAccounts.length === 0) {
      toast("Select at least one account", "error");
      return;
    }

    setSaving(true);
    try {
      const validMediaUrls = mediaUrls.filter((u) => u.trim());

      const mediaIds: string[] = [];
      for (const url of validMediaUrls) {
        const fileType = url.match(/\.(mp4|mov|avi|webm)/i) ? "video" : "image";
        const uploadResult = await socialApi.getUploadUrl({
          file_name: url.split("/").pop() || "media",
          file_type: fileType,
          file_size: 0,
          mime_type: fileType === "video" ? "video/mp4" : "image/jpeg",
        });
        await socialApi.confirmUpload({ media_id: uploadResult.id, url });
        mediaIds.push(uploadResult.id);
      }

      const postData = {
        caption,
        hashtags,
        post_type: postType,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        account_ids: selectedAccounts,
        media_ids: mediaIds,
      };

      if (editId) {
        const updated = await socialApi.updatePost(editId, postData);
        if (publish) {
          await socialApi.publishPost(updated.id);
          toast("Post published!", "success");
        } else {
          toast("Post updated", "success");
        }
      } else {
        const created = await socialApi.createPost(postData);
        if (publish) {
          await socialApi.publishPost(created.id);
          toast("Post published!", "success");
        } else {
          toast(scheduledAt ? "Post scheduled" : "Post saved as draft", "success");
        }
      }

      navigate("/social/queue");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save post", "error");
    } finally {
      setSaving(false);
    }
  };

  const charCount = caption.length;
  const fbAccounts = accounts.filter((a) => a.account_type === "facebook_page");
  const igAccounts = accounts.filter((a) => a.account_type === "instagram_business");

  return (
    <div className="animate-fadeIn max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent">
          {editId ? "Edit Post" : "Create Post"}
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-5">
          {/* Caption */}
          <div className="glass-panel rounded-xl p-5">
            <label className="block text-xs font-semibold text-[hsl(var(--th-text-secondary))] mb-2 uppercase tracking-wider">Caption</label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Write your caption..."
              rows={6}
              className="w-full px-4 py-3 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow resize-none"
            />
            <div className="flex justify-between mt-2">
              <span className={`text-xs ${charCount > 2200 ? "text-red-400" : "text-[hsl(var(--th-text-muted))]"}`}>
                {charCount} / 2,200 characters
              </span>
            </div>
          </div>

          {/* Hashtags */}
          <div className="glass-panel rounded-xl p-5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--th-text-secondary))] mb-2 uppercase tracking-wider">
              <Hash className="h-3.5 w-3.5" /> Hashtags
            </label>
            <textarea
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              placeholder="#marketing #socialmedia #content"
              rows={2}
              className="w-full px-4 py-3 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-shadow resize-none"
            />
          </div>

          {/* Media URLs */}
          <div className="glass-panel rounded-xl p-5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--th-text-secondary))] mb-2 uppercase tracking-wider">
              <Image className="h-3.5 w-3.5" /> Media
            </label>
            <div className="space-y-2">
              {mediaUrls.map((url, idx) => (
                <div key={idx} className="flex gap-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => handleMediaUrlChange(idx, e.target.value)}
                    placeholder="Enter image or video URL..."
                    className="flex-1 h-9 px-3 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                  {mediaUrls.length > 1 && (
                    <button onClick={() => handleRemoveMediaUrl(idx)} className="p-2 rounded-lg hover:bg-red-500/10 text-[hsl(var(--th-text-muted))] hover:text-red-400 transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={handleAddMediaUrl} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors mt-1">
                <Plus className="h-3 w-3" /> Add another media
              </button>
            </div>
            {mediaUrls.some((u) => u.trim()) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                {mediaUrls.filter((u) => u.trim()).map((url, idx) => (
                  <div key={idx} className="h-16 w-16 rounded-lg bg-[hsl(var(--th-input))] overflow-hidden border border-[hsl(var(--th-border))]">
                    <img src={url} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Post Type */}
          <div className="glass-panel rounded-xl p-5">
            <label className="block text-xs font-semibold text-[hsl(var(--th-text-secondary))] mb-2 uppercase tracking-wider">Post Type</label>
            <div className="flex gap-2 flex-wrap">
              {POST_TYPES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPostType(id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    postType === id
                      ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                      : "bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-muted))] border border-[hsl(var(--th-border))] hover:text-[hsl(var(--th-text-secondary))]"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Schedule */}
          <div className="glass-panel rounded-xl p-5">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[hsl(var(--th-text-secondary))] mb-2 uppercase tracking-wider">
              <Clock className="h-3.5 w-3.5" /> Schedule
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className="w-full h-9 px-3 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
            {scheduledAt && (
              <button onClick={() => setScheduledAt("")} className="text-xs text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))] mt-2 transition-colors">
                Clear schedule (save as draft)
              </button>
            )}
          </div>

          {/* Account selection */}
          <div className="glass-panel rounded-xl p-5">
            <label className="block text-xs font-semibold text-[hsl(var(--th-text-secondary))] mb-3 uppercase tracking-wider">
              Publish To
            </label>
            {loadingAccounts ? (
              <div className="space-y-2">
                {[1, 2].map((i) => <div key={i} className="h-10 rounded-lg bg-[hsl(var(--th-input))] animate-pulse" />)}
              </div>
            ) : accounts.length === 0 ? (
              <p className="text-xs text-[hsl(var(--th-text-muted))]">
                No accounts connected.{" "}
                <a href="/social/accounts" className="text-indigo-400 hover:text-indigo-300">Connect one</a>
              </p>
            ) : (
              <div className="space-y-3">
                {fbAccounts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Facebook className="h-3.5 w-3.5 text-blue-500" />
                      <span className="text-[10px] font-medium text-[hsl(var(--th-text-muted))] uppercase">Facebook</span>
                    </div>
                    {fbAccounts.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(a.id)}
                          onChange={() => toggleAccount(a.id)}
                          className="rounded border-[hsl(var(--th-border))] text-indigo-600 focus:ring-indigo-500/40"
                        />
                        <div className="h-6 w-6 rounded-full overflow-hidden bg-[hsl(var(--th-input))]">
                          {a.account_avatar_url ? <img src={a.account_avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <span className="text-xs text-[hsl(var(--th-text))] truncate">{a.account_name}</span>
                      </label>
                    ))}
                  </div>
                )}
                {igAccounts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Instagram className="h-3.5 w-3.5 text-pink-500" />
                      <span className="text-[10px] font-medium text-[hsl(var(--th-text-muted))] uppercase">Instagram</span>
                    </div>
                    {igAccounts.map((a) => (
                      <label key={a.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(a.id)}
                          onChange={() => toggleAccount(a.id)}
                          className="rounded border-[hsl(var(--th-border))] text-indigo-600 focus:ring-indigo-500/40"
                        />
                        <div className="h-6 w-6 rounded-full overflow-hidden bg-[hsl(var(--th-input))]">
                          {a.account_avatar_url ? <img src={a.account_avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        </div>
                        <span className="text-xs text-[hsl(var(--th-text))] truncate">{a.account_name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
            >
              <Clock className="h-4 w-4" />
              {saving ? "Saving..." : scheduledAt ? "Schedule Post" : "Save Draft"}
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] text-sm font-medium text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {saving ? "Publishing..." : "Publish Now"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
