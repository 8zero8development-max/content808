import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { api, ContentItem } from "@/api/client";
import { Product, MarketingAngle, productApi } from "@/api/productApi";
import { ProductPicker, SelectedProduct } from "@/components/ProductPicker";
import { useToast } from "@/components/ui/toast";
import { X } from "lucide-react";

interface ItemFormModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  item?: ContentItem | null;
}

const PLATFORMS = ["instagram", "tiktok", "youtube", "twitter", "facebook", "linkedin", "email", "blog"];

/** Normalise a marketing angle entry into {title,content} */
function normalizeAngle(a: string | MarketingAngle): { title: string; content: string } {
  if (typeof a === "string") return { title: a, content: "" };
  return { title: a.title, content: a.content };
}

export function ItemFormModal({ open, onClose, onSaved, item }: ItemFormModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fullProduct, setFullProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    brand: "",
    product_url: "",
    product_title: "",
    product_image_url: "",
    product_id: null as string | null,
    campaign_goal: null as { title: string; content: string } | null,
    direction: { benefits: [] as string[], pain_points: [] as string[] },
    target_audience: [] as string[],
    pivot_notes: "",
    platform: "",
    due_date: "",
    publish_date: "",
    assignee: "",
  });

  useEffect(() => {
    if (item) {
      // Parse campaign_goal - may be a string (legacy) or object
      let parsedGoal: { title: string; content: string } | null = null;
      if (item.campaign_goal) {
        if (typeof item.campaign_goal === "string") {
          parsedGoal = { title: item.campaign_goal, content: "" };
        } else {
          parsedGoal = item.campaign_goal;
        }
      }

      // Parse direction - may be a string (legacy) or object
      let parsedDirection = { benefits: [] as string[], pain_points: [] as string[] };
      if (item.direction) {
        if (typeof item.direction === "string") {
          parsedDirection = { benefits: [item.direction], pain_points: [] };
        } else {
          parsedDirection = {
            benefits: item.direction.benefits || [],
            pain_points: item.direction.pain_points || [],
          };
        }
      }

      const parsedAudience = Array.isArray(item.target_audience) ? item.target_audience : [];

      setForm({
        brand: item.brand || "",
        product_url: item.product_url || "",
        product_title: item.product_title || "",
        product_image_url: item.product_image_url || "",
        product_id: item.product_id || null,
        campaign_goal: parsedGoal,
        direction: parsedDirection,
        target_audience: parsedAudience,
        pivot_notes: item.pivot_notes || "",
        platform: item.platform || "",
        due_date: item.due_date ? item.due_date.slice(0, 16) : "",
        publish_date: item.publish_date ? item.publish_date.slice(0, 16) : "",
        assignee: item.assignee || "",
      });
    } else {
      setForm({
        brand: "", product_url: "", product_title: "", product_image_url: "",
        product_id: null, campaign_goal: null,
        direction: { benefits: [], pain_points: [] },
        target_audience: [],
        pivot_notes: "",
        platform: "", due_date: "", publish_date: "", assignee: "",
      });
      setFullProduct(null);
    }
  }, [item, open]);

  // When editing an existing item with a product_id, fetch the full product
  useEffect(() => {
    if (!open) return;
    if (item?.product_id) {
      productApi.getProduct(item.product_id)
        .then(setFullProduct)
        .catch(() => {
          if (item.product_title) {
            productApi.searchProducts({ q: item.product_title, limit: 1 })
              .then((res) => setFullProduct(res.items[0] || null))
              .catch(() => setFullProduct(null));
          }
        });
    }
  }, [item?.product_id, item?.product_title, open]);

  const setField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  /** When a product is selected from the picker */
  const handleProductSelect = (product: Product | null) => {
    if (product) {
      setFullProduct(product);
      setForm((prev) => ({
        ...prev,
        product_id: product.id,
        product_title: product.name,
        product_image_url: product.thumbnail || "",
        product_url: product.source_url || "",
        brand: product.brand || prev.brand,
        campaign_goal: null,
        direction: { benefits: [], pain_points: [] },
        target_audience: [],
      }));
    } else {
      setFullProduct(null);
      setForm((prev) => ({
        ...prev,
        product_id: null,
        product_title: "",
        product_image_url: "",
        product_url: "",
        campaign_goal: null,
        direction: { benefits: [], pain_points: [] },
        target_audience: [],
      }));
    }
  };

  /** Build the selected-product preview from current form state */
  const selectedProduct: SelectedProduct | null = form.product_id
    ? {
      product_id: form.product_id,
      product_title: form.product_title,
      product_image_url: form.product_image_url,
      product_url: form.product_url,
      brand: form.brand,
    }
    : null;

  /* -- Derived product data -- */
  const marketingAngles = (fullProduct?.marketing_angles || []).map(normalizeAngle);
  const productBenefits = fullProduct?.benefits || [];
  const productPainPoints = fullProduct?.pain_points || [];
  const productAudiences = fullProduct?.target_audience || [];

  const handleSubmit= async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brand.trim()) {
      toast("Brand is required", "error");
      return;
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        due_date: form.due_date || null,
        publish_date: form.publish_date || null,
        assignee: form.assignee || null,
        target_audience: form.target_audience.length > 0 ? form.target_audience : null,
        campaign_goal: form.campaign_goal || null,
        direction:
          form.direction.benefits.length > 0 || form.direction.pain_points.length > 0
            ? form.direction
            : null,
      };
      if (item) {
        await api.updateItem(item.id, payload);
        toast("Item updated", "success");
      } else {
        await api.createItem(payload);
        toast("Item created", "success");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
    } finally {
      setLoading(false);
    }
  };

  /* -- Checkbox helpers -- */
  const toggleBenefit = (b: string) => {
    setForm((prev) => {
      const arr = prev.direction.benefits;
      return { ...prev, direction: { ...prev.direction, benefits: arr.includes(b) ? arr.filter((x) => x !== b) : [...arr, b] } };
    });
  };
  const togglePainPoint = (p: string) => {
    setForm((prev) => {
      const arr = prev.direction.pain_points;
      return { ...prev, direction: { ...prev.direction, pain_points: arr.includes(p) ? arr.filter((x) => x !== p) : [...arr, p] } };
    });
  };
  const toggleAudience = (a: string) => {
    setForm((prev) => {
      const arr = prev.target_audience;
      return { ...prev, target_audience: arr.includes(a) ? arr.filter((x) => x !== a) : [...arr, a] };
    });
  };
  const removeAudience = (a: string) => {
    setForm((prev) => ({ ...prev, target_audience: prev.target_audience.filter((x) => x !== a) }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogClose onClick={onClose} />
        <DialogHeader>
          <DialogTitle>{item ? "Edit Item" : "Create New Item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Product Picker — replaces manual product fields */}
          <ProductPicker selected={selectedProduct} onSelect={handleProductSelect} />

          {/* Brand — editable, but auto-filled by product selection */}
          <Field
            label={form.product_id ? "Brand (from product)" : "Brand *"}
            value={form.brand}
            onChange={(v) => setField("brand", v)}
            placeholder="Brand name"
          />

          {/* Marketing-data fields (shown when a product is selected) */}
          {fullProduct && (
            <>
              {/* Campaign Goal - marketing angle dropdown */}
              {marketingAngles.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Campaign Goal (Marketing Angle)</label>
                  <select
                    value={form.campaign_goal?.title || ""}
                    onChange={(e) => {
                      const selected = marketingAngles.find((a) => a.title === e.target.value);
                      setField("campaign_goal", selected || null);
                    }}
                    className="w-full h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
                  >
                    <option value="">Select a marketing angle...</option>
                    {marketingAngles.map((a, i) => (
                      <option key={i} value={a.title}>{a.title}</option>
                    ))}
                  </select>
                  {form.campaign_goal?.content && (
                    <p className="mt-1.5 text-xs text-[hsl(var(--th-text-muted))] bg-[hsl(var(--th-input)/0.5)] rounded p-2">{form.campaign_goal.content}</p>
                  )}
                </div>
              )}

              {/* Direction - benefits & pain points checkboxes */}
              {(productBenefits.length > 0 || productPainPoints.length > 0) && (
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Direction</label>
                  {productBenefits.length > 0 && (
                    <div className="mb-3">
                      <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Benefits</span>
                      <div className="mt-1 space-y-1">
                        {productBenefits.map((b, i) => (
                          <label key={i} className="flex items-start gap-2 cursor-pointer group">
                            <input type="checkbox" checked={form.direction.benefits.includes(b)} onChange={() => toggleBenefit(b)} className="mt-0.5 rounded border-[hsl(var(--th-border))] bg-[hsl(var(--th-input))] text-emerald-500 focus:ring-emerald-500/30" />
                            <span className="text-sm text-[hsl(var(--th-text-secondary))] group-hover:text-[hsl(var(--th-text))]">{b}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {productPainPoints.length > 0 && (
                    <div>
                      <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Pain Points</span>
                      <div className="mt-1 space-y-1">
                        {productPainPoints.map((p, i) => (
                          <label key={i} className="flex items-start gap-2 cursor-pointer group">
                            <input type="checkbox" checked={form.direction.pain_points.includes(p)} onChange={() => togglePainPoint(p)} className="mt-0.5 rounded border-[hsl(var(--th-border))] bg-[hsl(var(--th-input))] text-amber-500 focus:ring-amber-500/30" />
                            <span className="text-sm text-[hsl(var(--th-text-secondary))] group-hover:text-[hsl(var(--th-text))]">{p}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Target Audience - multi-select tags */}
              {productAudiences.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Target Audience</label>
                  {form.target_audience.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {form.target_audience.map((a, i) => (
                        <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-cyan-500/15 text-cyan-400 font-medium">
                          {a}
                          <button type="button" onClick={() => removeAudience(a)} className="hover:text-cyan-200 transition-colors"><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {productAudiences.filter((a) => !form.target_audience.includes(a)).map((a, i) => (
                      <button key={i} type="button" onClick={() => toggleAudience(a)} className="text-xs px-2 py-1 rounded-full border border-[hsl(var(--th-border))] text-[hsl(var(--th-text-muted))] hover:border-cyan-500/40 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors">+ {a}</button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <Field label="Pivot Notes" value={form.pivot_notes} onChange={(v) => setField("pivot_notes", v)} placeholder="Any pivot notes" multiline />

          <div>
            <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Platform</label>
            <select
              value={form.platform}
              onChange={(e) => setField("platform", e.target.value)}
              className="w-full h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
            >
              <option value="">Select platform</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Due Date</label>
              <input
                type="datetime-local"
                value={form.due_date}
                onChange={(e) => setField("due_date", e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">Publish Date</label>
              <input
                type="datetime-local"
                value={form.publish_date}
                onChange={(e) => setField("publish_date", e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]"
              />
            </div>
          </div>

          <Field label="Assignee" value={form.assignee} onChange={(v) => setField("assignee", v)} placeholder="Assigned to..." />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-md bg-[hsl(var(--th-input))] text-[hsl(var(--th-text-secondary))] hover:bg-[hsl(var(--th-surface-hover))] transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors">
              {loading ? "Saving..." : item ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const cls = "w-full px-3 rounded-md bg-[hsl(var(--th-input))] border border-[hsl(var(--th-border))] text-sm text-[hsl(var(--th-text))] placeholder:text-[hsl(var(--th-text-muted))] focus:outline-none focus:ring-1 focus:ring-[hsl(var(--th-border))]";
  return (
    <div>
      <label className="block text-xs font-medium text-[hsl(var(--th-text-secondary))] mb-1.5">{label}</label>
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} className={`${cls} py-2`} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} h-9`} />
      )}
    </div>
  );
}
