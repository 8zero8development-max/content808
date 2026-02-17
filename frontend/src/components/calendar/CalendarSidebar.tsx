import { useState } from "react";
import { ContentItem } from "@/api/client";
import { StatusBadge, STATUS_CONFIG } from "@/components/ui/StatusBadge";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import {
    format, startOfMonth, startOfWeek,
    addDays, addMonths, subMonths, isSameMonth, isSameDay
} from "date-fns";

interface CalendarSidebarProps {
    currentDate: Date;
    onDateSelect: (date: Date) => void;
    items: ContentItem[];
}

export function CalendarSidebar({ currentDate, onDateSelect, items }: CalendarSidebarProps) {
    const [miniMonth, setMiniMonth] = useState(new Date());

    // Mini calendar grid
    const monthStart = startOfMonth(miniMonth);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const rows: Date[][] = [];
    let day = calStart;
    for (let w = 0; w < 6; w++) {
        const week: Date[] = [];
        for (let d = 0; d < 7; d++) {
            week.push(day);
            day = addDays(day, 1);
        }
        rows.push(week);
    }

    // Upcoming items — next 5 with dates
    const now = new Date();
    const upcoming = items
        .filter((i) => {
            const d = i.publish_date || i.due_date;
            return d && new Date(d) >= now;
        })
        .sort((a, b) => {
            const da = new Date(a.publish_date || a.due_date || "");
            const db = new Date(b.publish_date || b.due_date || "");
            return da.getTime() - db.getTime();
        })
        .slice(0, 5);

    // Status counts
    const statusCounts: Record<string, number> = {};
    items.forEach((i) => { statusCounts[i.status] = (statusCounts[i.status] || 0) + 1; });

    // Items with dates for dot indicators
    const itemDates = new Set(
        items
            .map((i) => i.publish_date || i.due_date)
            .filter(Boolean)
            .map((d) => format(new Date(d!), "yyyy-MM-dd"))
    );

    return (
        <div className="w-64 shrink-0 space-y-4">
            {/* Mini Calendar */}
            <div className="glass-panel rounded-xl p-3">
                <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setMiniMonth(subMonths(miniMonth, 1))} className="p-1 rounded-md hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] transition-colors">
                        <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-semibold text-[hsl(var(--th-text-secondary))]">{format(miniMonth, "MMMM yyyy")}</span>
                    <button onClick={() => setMiniMonth(addMonths(miniMonth, 1))} className="p-1 rounded-md hover:bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text-secondary))] transition-colors">
                        <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                </div>

                <div className="grid grid-cols-7 gap-0 mb-1">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                        <div key={i} className="text-center text-[10px] font-medium text-[hsl(var(--th-text-muted))] py-1">{d}</div>
                    ))}
                </div>

                {rows.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7 gap-0">
                        {week.map((d, di) => {
                            const inMonth = isSameMonth(d, miniMonth);
                            const isToday = isSameDay(d, new Date());
                            const isSelected = isSameDay(d, currentDate);
                            const hasItems = itemDates.has(format(d, "yyyy-MM-dd"));

                            return (
                                <button
                                    key={di}
                                    onClick={() => {
                                        onDateSelect(d);
                                        setMiniMonth(d);
                                    }}
                                    className={`relative h-7 w-full flex items-center justify-center text-[11px] rounded-md transition-all duration-150 ${!inMonth ? "text-[hsl(var(--th-text-muted))]" :
                                        isSelected ? "bg-indigo-600 text-white font-semibold" :
                                            isToday ? "text-indigo-400 font-semibold bg-indigo-500/10" :
                                                "text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))]"
                                        }`}
                                >
                                    {format(d, "d")}
                                    {hasItems && !isSelected && (
                                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-indigo-400" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Upcoming Items */}
            <div className="glass-panel rounded-xl p-3">
                <h3 className="text-xs font-semibold text-[hsl(var(--th-text-secondary))] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Upcoming
                </h3>
                {upcoming.length === 0 ? (
                    <p className="text-xs text-[hsl(var(--th-text-muted))] text-center py-2">No upcoming items</p>
                ) : (
                    <div className="space-y-2">
                        {upcoming.map((item) => {
                            const d = item.publish_date || item.due_date;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => d && onDateSelect(new Date(d))}
                                    className="w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-[hsl(var(--th-surface-hover))] transition-colors group"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-xs font-medium text-[hsl(var(--th-text-secondary))] truncate group-hover:text-[hsl(var(--th-text))] transition-colors">{item.brand}</p>
                                        <p className="text-[10px] text-[hsl(var(--th-text-muted))]">{d ? format(new Date(d), "MMM d, h:mm a") : ""}</p>
                                    </div>
                                    <StatusBadge status={item.status} showLabel={false} size="sm" className="mt-0.5" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Status Legend */}
            <div className="glass-panel rounded-xl p-3">
                <h3 className="text-xs font-semibold text-[hsl(var(--th-text-secondary))] uppercase tracking-wider mb-3">Legend</h3>
                <div className="space-y-1.5">
                    {Object.entries(STATUS_CONFIG).map(([status, config]) => (
                        <div key={status} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${config.dot}`} />
                                <span className="text-xs text-[hsl(var(--th-text-secondary))] capitalize">{status}</span>
                            </div>
                            {statusCounts[status] !== undefined && (
                                <span className="text-[10px] text-[hsl(var(--th-text-muted))] font-medium">{statusCounts[status]}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
