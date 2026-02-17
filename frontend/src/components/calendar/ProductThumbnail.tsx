import { ContentItem } from "@/api/client";

/** Shared brand-initial placeholder for items without product images */
export function ProductThumbnail({
    item,
    size = "sm",
    className = "",
}: {
    item: ContentItem;
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    const dims = size === "lg" ? "h-16 w-16" : size === "md" ? "h-10 w-10" : "h-7 w-7";
    const textSize = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-[10px]";
    const rounded = size === "lg" ? "rounded-xl" : size === "md" ? "rounded-lg" : "rounded-md";

    const initial = (item.product_title || item.brand || "?").charAt(0).toUpperCase();

    if (item.product_image_url) {
        return (
            <img
                src={item.product_image_url}
                alt={item.product_title || item.brand}
                className={`${dims} ${rounded} object-cover shrink-0 ${className}`}
                loading="lazy"
                onError={(e) => {
                    // Fallback to initial on broken image
                    const el = e.currentTarget;
                    el.style.display = "none";
                    el.nextElementSibling?.classList.remove("hidden");
                }}
            />
        );
    }

    return (
        <div
            className={`${dims} ${rounded} shrink-0 flex items-center justify-center font-bold ${textSize} bg-gradient-to-br from-indigo-600/30 to-violet-600/30 text-indigo-300 border border-indigo-500/20 ${className}`}
        >
            {initial}
        </div>
    );
}

/** Inline version with fallback hidden sibling pattern */
export function ProductThumbnailWithFallback({
    item,
    size = "sm",
    className = "",
}: {
    item: ContentItem;
    size?: "sm" | "md" | "lg";
    className?: string;
}) {
    const dims = size === "lg" ? "h-16 w-16" : size === "md" ? "h-10 w-10" : "h-7 w-7";
    const textSize = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-[10px]";
    const rounded = size === "lg" ? "rounded-xl" : size === "md" ? "rounded-lg" : "rounded-md";

    const initial = (item.product_title || item.brand || "?").charAt(0).toUpperCase();

    if (!item.product_image_url) {
        return (
            <div
                className={`${dims} ${rounded} shrink-0 flex items-center justify-center font-bold ${textSize} bg-gradient-to-br from-indigo-600/30 to-violet-600/30 text-indigo-300 border border-indigo-500/20 ${className}`}
            >
                {initial}
            </div>
        );
    }

    return (
        <div className={`relative ${dims} shrink-0 ${className}`}>
            <img
                src={item.product_image_url}
                alt={item.product_title || item.brand}
                className={`${dims} ${rounded} object-cover`}
                loading="lazy"
                onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = "none";
                    (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove("hidden");
                }}
            />
            <div
                className={`hidden absolute inset-0 ${rounded} flex items-center justify-center font-bold ${textSize} bg-gradient-to-br from-indigo-600/30 to-violet-600/30 text-indigo-300 border border-indigo-500/20`}
            >
                {initial}
            </div>
        </div>
    );
}
