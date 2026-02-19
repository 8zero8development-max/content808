import { useState, useEffect } from "react";
import { socialApi, AnalyticsSummary } from "@/api/socialApi";
import { useToast } from "@/components/ui/toast";
import { BarChart3, Eye, Users, Heart, MessageCircle, Share2, Bookmark, TrendingUp, Instagram, Facebook } from "lucide-react";
import { format } from "date-fns";

export function SocialAnalyticsPage() {
  const { toast } = useToast();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const data = await socialApi.getAnalyticsSummary();
      setSummary(data);
    } catch {
      toast("Failed to load analytics", "error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-fadeIn">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent mb-6">
          Analytics
        </h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-[hsl(var(--th-surface))] animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-16 animate-fadeIn">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4">
          <BarChart3 className="h-8 w-8 text-indigo-400" />
        </div>
        <h3 className="text-lg font-semibold text-[hsl(var(--th-text))] mb-2">No analytics data</h3>
        <p className="text-sm text-[hsl(var(--th-text-muted))]">Publish some posts to see analytics here.</p>
      </div>
    );
  }

  const statCards = [
    { label: "Published Posts", value: summary.total_published, icon: TrendingUp, color: "text-indigo-400" },
    { label: "Impressions", value: summary.total_impressions, icon: Eye, color: "text-cyan-400" },
    { label: "Reach", value: summary.total_reach, icon: Users, color: "text-violet-400" },
    { label: "Engagement", value: summary.total_engagement, icon: Heart, color: "text-pink-400" },
    { label: "Likes", value: summary.total_likes, icon: Heart, color: "text-red-400" },
    { label: "Comments", value: summary.total_comments, icon: MessageCircle, color: "text-amber-400" },
    { label: "Shares", value: summary.total_shares, icon: Share2, color: "text-emerald-400" },
    { label: "Saves", value: summary.total_saves, icon: Bookmark, color: "text-blue-400" },
  ];

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent">
          Analytics
        </h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="glass-panel rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[hsl(var(--th-text-muted))] font-medium">{label}</span>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className="text-2xl font-bold text-[hsl(var(--th-text))]">
              {value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Post Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[hsl(var(--th-text-secondary))] mb-4">Post Status</h3>
          <div className="space-y-3">
            {Object.entries(summary.by_status).map(([status, count]) => {
              const total = Object.values(summary.by_status).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
              const colors: Record<string, string> = {
                draft: "bg-zinc-500", scheduled: "bg-blue-500", publishing: "bg-amber-500",
                published: "bg-emerald-500", failed: "bg-red-500",
              };
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="text-xs text-[hsl(var(--th-text-muted))] w-20 capitalize">{status}</span>
                  <div className="flex-1 h-2 rounded-full bg-[hsl(var(--th-input))] overflow-hidden">
                    <div className={`h-full rounded-full ${colors[status] || "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-medium text-[hsl(var(--th-text-secondary))] w-12 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel rounded-xl p-5">
          <h3 className="text-sm font-semibold text-[hsl(var(--th-text-secondary))] mb-4">By Platform</h3>
          {summary.by_platform.length === 0 ? (
            <p className="text-xs text-[hsl(var(--th-text-muted))]">No platform data yet.</p>
          ) : (
            <div className="space-y-4">
              {summary.by_platform.map((p) => (
                <div key={p.account_type} className="flex items-center gap-3">
                  {p.account_type === "instagram_business" ? (
                    <Instagram className="h-5 w-5 text-pink-500 shrink-0" />
                  ) : (
                    <Facebook className="h-5 w-5 text-blue-500 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-[hsl(var(--th-text))]">
                      {p.account_type === "instagram_business" ? "Instagram" : "Facebook"}
                    </p>
                    <p className="text-[10px] text-[hsl(var(--th-text-muted))]">
                      {p.post_count} posts | {p.impressions.toLocaleString()} impressions | {p.engagement.toLocaleString()} engagement
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Posts Performance */}
      <div className="glass-panel rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[hsl(var(--th-text-secondary))] mb-4">Recent Post Performance</h3>
        {summary.recent_posts.length === 0 ? (
          <p className="text-xs text-[hsl(var(--th-text-muted))]">No published posts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[hsl(var(--th-border))]">
                  <th className="text-left py-2 px-3 font-medium text-[hsl(var(--th-text-muted))]">Post</th>
                  <th className="text-right py-2 px-3 font-medium text-[hsl(var(--th-text-muted))]">Date</th>
                  <th className="text-right py-2 px-3 font-medium text-[hsl(var(--th-text-muted))]">Impressions</th>
                  <th className="text-right py-2 px-3 font-medium text-[hsl(var(--th-text-muted))]">Reach</th>
                  <th className="text-right py-2 px-3 font-medium text-[hsl(var(--th-text-muted))]">Engagement</th>
                  <th className="text-right py-2 px-3 font-medium text-[hsl(var(--th-text-muted))]">Likes</th>
                </tr>
              </thead>
              <tbody>
                {summary.recent_posts.map((post) => (
                  <tr key={post.id} className="border-b border-[hsl(var(--th-border)/0.3)] hover:bg-[hsl(var(--th-surface-hover))]">
                    <td className="py-2 px-3 text-[hsl(var(--th-text))] max-w-[200px] truncate">{post.caption || "—"}</td>
                    <td className="py-2 px-3 text-right text-[hsl(var(--th-text-muted))]">
                      {post.published_at ? format(new Date(post.published_at), "MMM d") : "—"}
                    </td>
                    <td className="py-2 px-3 text-right text-[hsl(var(--th-text-secondary))]">{post.impressions.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-[hsl(var(--th-text-secondary))]">{post.reach.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-[hsl(var(--th-text-secondary))]">{post.engagement.toLocaleString()}</td>
                    <td className="py-2 px-3 text-right text-[hsl(var(--th-text-secondary))]">{post.likes.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
