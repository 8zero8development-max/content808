import { useState, useEffect } from "react";
import { api, Plugin } from "@/api/client";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Settings, ToggleLeft, ToggleRight } from "lucide-react";

export function SettingsPage() {
  const { toast } = useToast();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPlugins()
      .then((data) => setPlugins(data.plugins))
      .catch(() => toast("Failed to load plugins", "error"))
      .finally(() => setLoading(false));
  }, [toast]);

  const togglePlugin = async (plugin: Plugin) => {
    try {
      await api.updatePlugin(plugin.id, { enabled: !plugin.enabled });
      setPlugins((prev) => prev.map((p) => p.id === plugin.id ? { ...p, enabled: !p.enabled } : p));
      toast(`${plugin.name} ${plugin.enabled ? "disabled" : "enabled"}`, "success");
    } catch {
      toast("Failed to update plugin", "error");
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-[hsl(var(--th-text-muted))]">Loading...</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-[hsl(var(--th-text-muted))] mt-1">Manage plugins and extensions</p>
      </div>

      <div className="bg-[hsl(var(--th-surface))] border border-[hsl(var(--th-border))] rounded-lg">
        <div className="px-4 py-3 border-b border-[hsl(var(--th-border))]">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Settings className="h-4 w-4 text-[hsl(var(--th-text-muted))]" />
            Plugin Registry
          </h2>
        </div>

        {plugins.length === 0 ? (
          <div className="p-8 text-center text-sm text-[hsl(var(--th-text-muted))]">No plugins registered yet.</div>
        ) : (
          <div className="divide-y divide-[hsl(var(--th-border))]">
            {plugins.map((plugin) => (
              <div key={plugin.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-[hsl(var(--th-text))]">{plugin.name}</span>
                    <Badge variant="secondary" className="text-[10px]">{plugin.type}</Badge>
                    {plugin.mount_point && (
                      <span className="text-[10px] text-[hsl(var(--th-text-muted))]">@ {plugin.mount_point}</span>
                    )}
                  </div>
                  {plugin.description && <p className="text-xs text-[hsl(var(--th-text-muted))]">{plugin.description}</p>}
                </div>
                <button onClick={() => togglePlugin(plugin)} className="shrink-0">
                  {plugin.enabled ? (
                    <ToggleRight className="h-6 w-6 text-emerald-400" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-[hsl(var(--th-text-muted))]" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
