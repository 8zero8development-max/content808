import { Search, X } from "lucide-react";

interface CalendarFilterBarProps {
    filters: {
        brand: string;
        platform: string;
        status: string;
        assignee: string;
    };
    onChange: (filters: CalendarFilterBarProps["filters"]) => void;
}

const PLATFORMS = ["", "instagram", "tiktok", "youtube", "twitter", "facebook", "linkedin", "email", "blog"];
const STATUSES = ["", "idea", "draft", "review", "approved", "blocked", "scheduled", "published"];

export function CalendarFilterBar({ filters, onChange }: CalendarFilterBarProps) {
    const set = (key: keyof typeof filters, value: string) =>
        onChange({ ...filters, [key]: value });

    const hasFilters = filters.brand || filters.platform || filters.status || filters.assignee;

    return (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Brand search */}
            <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--th-text-muted))] pointer-events-none" />
                <input
                    type="text"
                    value={filters.brand}
                    onChange={(e) => set("brand", e.target.value)}
                    placeholder="Brand..."
                    className="h-8 pl-8 pr-3 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-36 transition-shadow"
                />
            </div>

            {/* Platform */}
            <select
                value={filters.platform}
                onChange={(e) => set("platform", e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-secondary))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-shadow"
            >
                <option value="">All Platforms</option>
                {PLATFORMS.filter(Boolean).map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
            </select>

            {/* Status */}
            <select
                value={filters.status}
                onChange={(e) => set("status", e.target.value)}
                className="h-8 px-2.5 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-secondary))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-shadow"
            >
                <option value="">All Statuses</option>
                {STATUSES.filter(Boolean).map((s) => (
                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
            </select>

            {/* Assignee */}
            <input
                type="text"
                value={filters.assignee}
                onChange={(e) => set("assignee", e.target.value)}
                placeholder="Assignee..."
                className="h-8 px-3 text-xs rounded-lg bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-indigo-500/40 w-28 transition-shadow"
            />

            {/* Clear */}
            {hasFilters && (
                <button
                    onClick={() => onChange({ brand: "", platform: "", status: "", assignee: "" })}
                    className="flex items-center gap-1 h-8 px-2.5 text-xs rounded-lg bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] hover:text-[hsl(var(--th-text))] hover:bg-[hsl(var(--th-input))] transition-colors"
                >
                    <X className="h-3 w-3" />
                    Clear
                </button>
            )}
        </div>
    );
}
