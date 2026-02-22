import { Product } from "@/api/productApi";

interface PriceTagProps {
    product: Product;
    size?: "sm" | "md";
    className?: string;
}

export function PriceTag({ product, size = "sm", className = "" }: PriceTagProps) {
    const { selling_price, price_point } = product;

    if (!selling_price) return null;

    const mainSize = size === "md" ? "text-base" : "text-sm";
    const subSize = size === "md" ? "text-sm" : "text-xs";

    return (
        <span className={`inline-flex items-center gap-2 ${className}`}>
            <span className={`font-semibold text-[hsl(var(--th-text))] ${mainSize}`}>{selling_price}</span>
            {price_point && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 ${subSize}`}>
                    {price_point}
                </span>
            )}
        </span>
    );
}
