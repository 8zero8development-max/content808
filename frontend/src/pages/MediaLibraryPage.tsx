import { useState, useEffect } from "react";
import { socialApi, MediaItem } from "@/api/socialApi";
import { useToast } from "@/components/ui/toast";
import { Image, Film, Trash2, Plus, Filter } from "lucide-react";
import { format } from "date-fns";

export function MediaLibraryPage() {
  const { toast } = useToast();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [typeFilter, setTypeFilter] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, [typeFilter]);

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (typeFilter) params.file_type = typeFilter;
      const data = await socialApi.getMedia(params);
      setMedia(data.media);
      setTotal(data.total);
    } catch {
      toast("Failed to load media", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddMedia = async () => {
    if (!newUrl.trim()) return;
    setAdding(true);
    try {
      const fileName = newUrl.split("/").pop() || "media";
      const isVideo = /\.(mp4|mov|avi|webm)/i.test(newUrl);
      const fileType = isVideo ? "video" : "image";
      const mimeType = isVideo ? "video/mp4" : "image/jpeg";

      const uploadResult = await socialApi.getUploadUrl({
        file_name: fileName,
        file_type: fileType,
        file_size: 0,
        mime_type: mimeType,
      });

      await socialApi.confirmUpload({
        media_id: uploadResult.id,
        url: newUrl,
      });

      toast("Media added", "success");
      setNewUrl("");
      fetchMedia();
    } catch {
      toast("Failed to add media", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this media?")) return;
    try {
      await socialApi.deleteMedia(id);
      setMedia((prev) => prev.filter((m) => m.id !== id));
      toast("Media deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    }
  };

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent">
            Media Library
          </h1>
          <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1">{total} items</p>
        </div>
      </div>

      {/* Add media */}
      <div className="glass-panel rounded-xl p-4 mb-6">
        <div className="flex gap-2">
          <input
            type="url"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Enter image or video URL to add to library..."
            className="flex-1 h-10 px-4 rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            onKeyDown={(e) => e.key === "Enter" && handleAddMedia()}
          />
          <button
            onClick={handleAddMedia}
            disabled={adding || !newUrl.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {adding ? "Adding..." : "Add Media"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-4 w-4 text-[hsl(var(--th-text-muted))]" />
        {["", "image", "video"].map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              typeFilter === t
                ? "bg-indigo-600/20 text-indigo-400 border border-indigo-500/30"
                : "text-[hsl(var(--th-text-muted))] hover:text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))]"
            }`}
          >
            {t === "image" && <Image className="h-3 w-3" />}
            {t === "video" && <Film className="h-3 w-3" />}
            {t || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="aspect-square rounded-xl bg-[hsl(var(--th-surface))] animate-pulse" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Image className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-[hsl(var(--th-text))] mb-2">No media yet</h3>
          <p className="text-sm text-[hsl(var(--th-text-muted))]">Add images and videos to your library for use in social posts.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {media.map((item) => (
            <div key={item.id} className="group relative aspect-square rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] overflow-hidden">
              {item.url ? (
                item.file_type === "video" ? (
                  <div className="h-full w-full flex items-center justify-center bg-[hsl(var(--th-input))]">
                    <Film className="h-8 w-8 text-[hsl(var(--th-text-muted))]" />
                  </div>
                ) : (
                  <img src={item.url} alt={item.file_name} className="h-full w-full object-cover" />
                )
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-[hsl(var(--th-input))]">
                  <Image className="h-8 w-8 text-[hsl(var(--th-text-muted))]" />
                </div>
              )}

              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-[10px] text-white/80 truncate">{item.file_name}</p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-white/60">{format(new Date(item.created_at), "MMM d")}</span>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-1 rounded hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Type badge */}
              <div className="absolute top-2 right-2">
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-medium backdrop-blur-sm ${
                  item.file_type === "video" ? "bg-violet-500/30 text-violet-200" : "bg-indigo-500/30 text-indigo-200"
                }`}>
                  {item.file_type === "video" ? <Film className="h-2.5 w-2.5" /> : <Image className="h-2.5 w-2.5" />}
                  {item.file_type}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
