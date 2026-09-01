import React, { useEffect, useMemo, useState } from "react";
import { CalendarDays, CheckCircle2, ImagePlus, Loader2, Megaphone, Tag, XCircle } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";

function StatsStrip({ stats }) {
  return (
    <div className="grid grid-cols-2 divide-y divide-black/10 overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm md:grid-cols-2 md:divide-y-0 md:divide-x">
      {stats.map((stat) => (
        <div key={stat.label} className="px-6 py-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.25em] text-black/50">{stat.label}</p>
          <p className={`text-[28px] font-bold leading-none ${stat.tone || "text-black"}`}>{stat.value}</p>
        </div>
      ))}
    </div>
  );
}

function Panel({ eyebrow, title, action, children, className = "" }) {
  return (
    <section className={`rounded-2xl border border-black/10 bg-white shadow-sm ${className}`}>
      <div className="flex items-center justify-between gap-4 border-b border-black/10 px-5 py-4">
        <div>
          {eyebrow && (
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.3em] text-[#D4AF37]">{eyebrow}</p>
          )}
          <h2 className="text-[15px] font-semibold text-black">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function getStoredUser() {
  if (typeof window === "undefined") return null;

  try {
    return JSON.parse(window.localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

const emptyForm = {
  title: "",
  message: "",
  coupon_code: "",
  starts_at: "",
  ends_at: "",
};

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function Promotions() {
  const [user, setUser] = useState(() => getStoredUser());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [promotions, setPromotions] = useState([]);

  const metrics = useMemo(() => {
    const sent = promotions.filter((item) => item.status === "sent").length;
    const needsAttention = promotions.filter((item) => item.status === "failed" || item.status === "sent_with_failures").length;

    return { sent, needsAttention };
  }, [promotions]);

  const stats = [
    { label: "Sent", value: metrics.sent, tone: "text-[#2f6f4a]" },
    { label: "Needs attention", value: metrics.needsAttention, tone: "text-[#c14d4d]" },
  ];

  const fetchPromotions = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const url = new URL(`${LARAVEL_BASE}/api/admin/promotions`);
      url.searchParams.set("user_id", String(user.id));

      const response = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load promotions.");
      }

      setPromotions(Array.isArray(data.data) ? data.data : []);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load promotions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setUser(getStoredUser());
  }, []);

  useEffect(() => {
    fetchPromotions();
  }, [user?.id]);

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : "");
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      setError("Please sign in again to manage promotions.");
      return;
    }

    const payload = new FormData();
    payload.append("title", form.title.trim());
    payload.append("message", form.message.trim());
    payload.append("coupon_code", form.coupon_code.trim());
    payload.append("starts_at", form.starts_at);
    payload.append("ends_at", form.ends_at);
    payload.append("user_id", String(user.id));
    if (imageFile) payload.append("image", imageFile);

    if (!form.title.trim() || !form.message.trim() || !form.starts_at || !form.ends_at) {
      setError("Title, message, start date, and end date are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const response = await fetch(`${LARAVEL_BASE}/api/admin/promotions/send?user_id=${user.id}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: payload,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to send the promotion.");
      }

      setNotice("Promotion scheduled and sent to subscribed customers successfully.");
      setForm(emptyForm);
      setImageFile(null);
      setImagePreview("");
      await fetchPromotions();
    } catch (submitError) {
      setError(submitError.message || "Unable to send the promotion.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black">
      <div className="pt-[72px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-10">
          <div className="mb-6 flex flex-col gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#D4AF37]">Marketing</p>
            <h1 className="text-[26px] font-bold text-black">Promotions</h1>
          </div>

          <div className="mb-6">
            <StatsStrip stats={stats} />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <Panel
              eyebrow="Campaign"
              title="Send promotion"
              action={
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                  <Megaphone size={11} />
                  Admin
                </div>
              }
            >
              <div className="p-4">
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Title</span>
                    <input
                      type="text"
                      name="title"
                      value={form.title}
                      onChange={handleInputChange}
                      placeholder="Weekend pastry special"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-black placeholder:text-black/35 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Coupon code</span>
                    <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
                      <Tag size={15} className="text-black/40" />
                      <input
                        type="text"
                        name="coupon_code"
                        value={form.coupon_code}
                        onChange={handleInputChange}
                        placeholder="SPECIAL10"
                        className="w-full bg-transparent text-[13px] text-black placeholder:text-black/35 outline-none"
                      />
                    </div>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Message</span>
                    <textarea
                      name="message"
                      rows="5"
                      value={form.message}
                      onChange={handleInputChange}
                      placeholder="Tell customers about the offer, perks, or seasonal highlight."
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] leading-5 text-black placeholder:text-black/35 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Starts</span>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
                        <CalendarDays size={15} className="text-black/40" />
                        <input
                          type="datetime-local"
                          name="starts_at"
                          value={form.starts_at}
                          onChange={handleInputChange}
                          className="w-full bg-transparent text-[13px] text-black outline-none"
                        />
                      </div>
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Ends</span>
                      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
                        <CalendarDays size={15} className="text-black/40" />
                        <input
                          type="datetime-local"
                          name="ends_at"
                          value={form.ends_at}
                          onChange={handleInputChange}
                          className="w-full bg-transparent text-[13px] text-black outline-none"
                        />
                      </div>
                    </label>
                  </div>

                  <label className="block">
                    <span className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.2em] text-black/45">Promotion image</span>
                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3.5 py-3 transition hover:border-slate-400">
                        <ImagePlus size={18} className="text-black/50" />
                        <span className="min-w-0 flex-1 text-[13px] text-black/65">
                          {imageFile ? imageFile.name : "Choose an image to include in the email"}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-black/45">Browse</span>
                        <input
                          type="file"
                          name="image"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          onChange={handleImageChange}
                          className="sr-only"
                        />
                      </label>
                      {imagePreview && (
                        <img
                          src={imagePreview}
                          alt="Promotion preview"
                          className="mt-3 max-h-40 w-full rounded-lg object-cover"
                        />
                      )}
                      <p className="mt-2 text-[11px] text-black/45">JPG, PNG, GIF, or WebP up to 5 MB.</p>
                    </div>
                  </label>
                </div>

                {error && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                    <XCircle size={16} />
                    {error}
                  </div>
                )}

                {notice && (
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
                    <CheckCircle2 size={16} />
                    {notice}
                  </div>
                )}

                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-black px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-black/90 disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                    {saving ? "Sending..." : "Send promotion"}
                  </button>
                </div>
              </div>
            </Panel>

            <Panel eyebrow="Recent campaigns" title="Campaign history">
              <div className="max-h-[560px] overflow-y-auto p-4">
                {loading ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Loading promotions...
                  </div>
                ) : promotions.length === 0 ? (
                  <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-500">
                    No promotions have been sent yet.
                  </div>
                ) : (
                    <div className="space-y-2.5">
                    {promotions.map((promotion) => (
                      <div key={promotion.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-slate-300 hover:bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[15px] font-semibold text-black">{promotion.title}</p>
                            <p className="mt-1 text-[12px] text-black/60">{promotion.description}</p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] ${promotion.status === "sent" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {promotion.status || "draft"}
                          </span>
                        </div>

                        {promotion.coupon_code && (
                          <div className="mt-3 inline-flex rounded-full bg-[#1e1e1e] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f1d06a]">
                            {promotion.coupon_code}
                          </div>
                        )}

                        <div className="mt-3 grid gap-2 text-[11px] text-black/60 sm:grid-cols-2">
                          <p><span className="font-medium text-black">Starts:</span> {formatDate(promotion.starts_at)}</p>
                          <p><span className="font-medium text-black">Ends:</span> {formatDate(promotion.ends_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
