import { useState, useEffect } from "react";
import { socialApi, SocialAccount } from "@/api/socialApi";
import { useToast } from "@/components/ui/toast";
import { Link2, Unlink, RefreshCw, ExternalLink, Instagram, Facebook, AlertTriangle, CheckCircle, Clock } from "lucide-react";

export function SocialAccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    fetchAccounts();
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      toast(`${params.get("connected")} account(s) connected successfully`, "success");
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (params.get("error")) {
      toast(params.get("error") || "Connection failed", "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const data = await socialApi.getAccounts();
      setAccounts(data.accounts);
    } catch {
      toast("Failed to load accounts", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    try {
      setConnecting(true);
      const data = await socialApi.getAuthUrl();
      window.location.href = data.url;
    } catch {
      toast("Failed to start connection", "error");
      setConnecting(false);
    }
  };

  const handleToggle = async (id: string) => {
    try {
      const result = await socialApi.toggleAccount(id);
      setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, is_active: result.is_active } : a)));
      toast(result.is_active ? "Account enabled" : "Account disabled", "success");
    } catch {
      toast("Failed to toggle account", "error");
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm("Are you sure you want to disconnect this account?")) return;
    try {
      await socialApi.disconnectAccount(id);
      setAccounts((prev) => prev.filter((a) => a.id !== id));
      toast("Account disconnected", "success");
    } catch {
      toast("Failed to disconnect account", "error");
    }
  };

  const handleRefreshToken = async (id: string) => {
    try {
      await socialApi.refreshToken(id);
      toast("Token refreshed", "success");
      fetchAccounts();
    } catch {
      toast("Failed to refresh token", "error");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="h-4 w-4 text-emerald-400" />;
      case "expiring_soon": return <Clock className="h-4 w-4 text-amber-400" />;
      case "expired": return <AlertTriangle className="h-4 w-4 text-red-400" />;
      default: return <Clock className="h-4 w-4 text-zinc-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "active": return "Active";
      case "expiring_soon": return "Expiring Soon";
      case "expired": return "Expired";
      default: return "Unknown";
    }
  };

  const facebookAccounts = accounts.filter((a) => a.account_type === "facebook_page");
  const instagramAccounts = accounts.filter((a) => a.account_type === "instagram_business");

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-[hsl(var(--th-text))] to-[hsl(var(--th-text-secondary))] bg-clip-text text-transparent">
            Connected Accounts
          </h1>
          <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1">
            Manage your Facebook Pages and Instagram Business accounts
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={connecting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all duration-200 shadow-lg shadow-indigo-600/20 disabled:opacity-50"
        >
          <Link2 className="h-4 w-4" />
          {connecting ? "Connecting..." : "Connect Meta Account"}
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[hsl(var(--th-surface))] animate-pulse" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-16">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Link2 className="h-8 w-8 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-[hsl(var(--th-text))] mb-2">No accounts connected</h3>
          <p className="text-sm text-[hsl(var(--th-text-muted))] mb-6 max-w-md mx-auto">
            Connect your Facebook Pages and Instagram Business accounts to start scheduling and publishing posts.
          </p>
          <button
            onClick={handleConnect}
            disabled={connecting}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-sm font-semibold hover:from-indigo-500 hover:to-indigo-400 transition-all shadow-lg shadow-indigo-600/20"
          >
            <ExternalLink className="h-4 w-4" />
            Connect with Meta
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {facebookAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Facebook className="h-5 w-5 text-blue-500" />
                <h2 className="text-sm font-semibold text-[hsl(var(--th-text-secondary))]">Facebook Pages</h2>
                <span className="text-xs text-[hsl(var(--th-text-muted))]">({facebookAccounts.length})</span>
              </div>
              <div className="space-y-2">
                {facebookAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onToggle={handleToggle}
                    onDisconnect={handleDisconnect}
                    onRefreshToken={handleRefreshToken}
                    getStatusIcon={getStatusIcon}
                    getStatusLabel={getStatusLabel}
                  />
                ))}
              </div>
            </div>
          )}

          {instagramAccounts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Instagram className="h-5 w-5 text-pink-500" />
                <h2 className="text-sm font-semibold text-[hsl(var(--th-text-secondary))]">Instagram Business</h2>
                <span className="text-xs text-[hsl(var(--th-text-muted))]">({instagramAccounts.length})</span>
              </div>
              <div className="space-y-2">
                {instagramAccounts.map((account) => (
                  <AccountCard
                    key={account.id}
                    account={account}
                    onToggle={handleToggle}
                    onDisconnect={handleDisconnect}
                    onRefreshToken={handleRefreshToken}
                    getStatusIcon={getStatusIcon}
                    getStatusLabel={getStatusLabel}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AccountCard({
  account,
  onToggle,
  onDisconnect,
  onRefreshToken,
  getStatusIcon,
  getStatusLabel,
}: {
  account: SocialAccount;
  onToggle: (id: string) => void;
  onDisconnect: (id: string) => void;
  onRefreshToken: (id: string) => void;
  getStatusIcon: (status: string) => React.ReactNode;
  getStatusLabel: (status: string) => string;
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-xl border border-[hsl(var(--th-border))] bg-[hsl(var(--th-surface))] transition-all hover:border-[hsl(var(--th-border))]/80 ${!account.is_active ? "opacity-60" : ""}`}>
      <div className="h-10 w-10 rounded-full overflow-hidden bg-[hsl(var(--th-input))] shrink-0">
        {account.account_avatar_url ? (
          <img src={account.account_avatar_url} alt={account.account_name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-sm font-bold text-[hsl(var(--th-text-muted))]">
            {account.account_name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[hsl(var(--th-text))] truncate">{account.account_name}</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
            account.account_type === "facebook_page" ? "bg-blue-500/10 text-blue-400" : "bg-pink-500/10 text-pink-400"
          }`}>
            {account.account_type === "facebook_page" ? "Facebook Page" : "Instagram"}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1">
            {getStatusIcon(account.token_status)}
            <span className="text-xs text-[hsl(var(--th-text-muted))]">{getStatusLabel(account.token_status)}</span>
          </div>
          {account.token_expires_at && (
            <span className="text-[10px] text-[hsl(var(--th-text-muted))]">
              Expires: {new Date(account.token_expires_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {(account.token_status === "expiring_soon" || account.token_status === "expired") && (
          <button
            onClick={() => onRefreshToken(account.id)}
            className="p-2 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] text-amber-400 hover:text-amber-300 transition-colors"
            title="Refresh token"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
        <button
          onClick={() => onToggle(account.id)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${account.is_active ? "bg-indigo-600" : "bg-[hsl(var(--th-input))]"}`}
        >
          <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${account.is_active ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
        </button>
        <button
          onClick={() => onDisconnect(account.id)}
          className="p-2 rounded-lg hover:bg-red-500/10 text-[hsl(var(--th-text-muted))] hover:text-red-400 transition-colors"
          title="Disconnect"
        >
          <Unlink className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
