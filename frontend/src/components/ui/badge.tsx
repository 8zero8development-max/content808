import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

const variants: Record<string, string> = {
  default: "bg-[hsl(var(--th-surface-hover))] text-[hsl(var(--th-text))]",
  secondary: "bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))]",
  destructive: "bg-red-600 text-white",
  outline: "border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-secondary))]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", variants[variant], className)}>
      {children}
    </span>
  );
}
