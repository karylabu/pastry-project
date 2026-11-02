import React, { useEffect, useState } from "react";
import { FileText, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

const PAGE_OPTIONS = [
  { slug: "about-us", label: "About Us" },
  { slug: "terms", label: "Terms & Conditions" },
  { slug: "privacy-policy", label: "Privacy Policy" },
  { slug: "cookie-policy", label: "Cookie Policy" },
  { slug: "return-policy", label: "Return Policy" },
  { slug: "contact-information", label: "Contact Information & Business Details" },
];

function requestOptions(method, body) {
  return {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
}

export default function ContentPages() {
  const [pages, setPages] = useState([]);
  const [selectedSlug, setSelectedSlug] = useState(PAGE_OPTIONS[0].slug);
  const [form, setForm] = useState({ title: "", content: "", is_published: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedPage = pages.find((page) => page.slug === selectedSlug);
  const pageDeleted = Boolean(selectedPage?.deleted_at);

  const loadPages = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/content-pages`, requestOptions("GET"));
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load content pages.");
      }

      const loadedPages = Array.isArray(data.data) ? data.data : [];
      setPages(loadedPages);
      setError("");
    } catch (loadError) {
      setError(loadError.message || "Unable to load content pages.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    const option = PAGE_OPTIONS.find((page) => page.slug === selectedSlug);
    const page = pages.find((item) => item.slug === selectedSlug);
    setForm({
      title: page?.title || option?.label || "",
      content: page?.content || "",
      is_published: page?.is_published ?? true,
    });
  }, [pages, selectedSlug]);

  const savePage = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const isCreate = !selectedPage || pageDeleted;
      const url = isCreate
        ? `${LARAVEL_BASE}/api/admin/content-pages`
        : `${LARAVEL_BASE}/api/admin/content-pages/${encodeURIComponent(selectedSlug)}`;
      const response = await fetch(url, requestOptions(isCreate ? "POST" : "PUT", {
        ...(isCreate ? { slug: selectedSlug } : {}),
        ...form,
      }));
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to save this page.");
      }

      await loadPages();
      setNotice(data.message || "Page saved successfully.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save this page.");
    } finally {
      setSaving(false);
    }
  };

  const deletePage = async () => {
    if (!window.confirm(`Delete "${form.title}"? It will no longer be visible to customers.`)) return;

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `${LARAVEL_BASE}/api/admin/content-pages/${encodeURIComponent(selectedSlug)}`,
        requestOptions("DELETE")
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to delete this page.");
      }

      await loadPages();
      setNotice(data.message || "Page deleted successfully.");
    } catch (deleteError) {
      setError(deleteError.message || "Unable to delete this page.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] px-4 py-6 text-[#33251e] sm:px-6 lg:pl-[280px]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#92701e]">Website management</p>
          <h1 className="text-2xl font-bold">Content Management</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#75675f]">
            Edit the pages customers see. Content is plain text; line breaks are preserved and HTML is not executed.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <section className="overflow-hidden rounded-lg border border-[#e9e1d9] bg-white">
            <div className="border-b border-[#eee6de] px-4 py-3">
              <h2 className="text-sm font-semibold">Pages</h2>
            </div>
            {loading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-[#75675f]"><Loader2 size={16} className="animate-spin" /> Loading pages...</div>
            ) : (
              <div className="p-2">
                {PAGE_OPTIONS.map((option) => {
                  const page = pages.find((item) => item.slug === option.slug);
                  const isDeleted = Boolean(page?.deleted_at);
                  return (
                    <button
                      key={option.slug}
                      type="button"
                      onClick={() => {
                        setNotice("");
                        setSelectedSlug(option.slug);
                      }}
                      className={`mb-1 flex w-full items-center justify-between gap-2 rounded-md px-3 py-2.5 text-left text-sm transition ${
                        selectedSlug === option.slug ? "bg-[#fff4d6] font-semibold text-[#33251e]" : "text-[#665951] hover:bg-[#fbfaf5]"
                      }`}
                    >
                      <span className="flex items-center gap-2"><FileText size={15} />{option.label}</span>
                      <span className={`text-[10px] ${isDeleted ? "text-red-600" : "text-[#7b8b65]"}`}>
                        {isDeleted ? "Deleted" : page?.is_published ? "Published" : "Draft"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <form onSubmit={savePage} className="rounded-lg border border-[#e9e1d9] bg-white">
            <div className="border-b border-[#eee6de] px-4 py-3.5 sm:px-5">
              <h2 className="text-sm font-semibold">{form.title || "Edit page"}</h2>
              <p className="mt-1 text-xs text-[#8a7a70]">Changes appear on the customer-facing page after saving.</p>
            </div>
            <div className="space-y-4 p-4 sm:p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#5f514a]">Page title</span>
                <input
                  required
                  maxLength={150}
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  className="w-full rounded-md border border-[#ddd2c8] px-3 py-2.5 text-sm outline-none focus:border-[#c9a94f] focus:ring-2 focus:ring-[#c9a94f]/20"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-[#5f514a]">Page content</span>
                <textarea
                  rows={18}
                  maxLength={50000}
                  value={form.content}
                  onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                  placeholder="Write the page content here. Separate paragraphs with a blank line."
                  className="w-full resize-y rounded-md border border-[#ddd2c8] px-3 py-2.5 text-sm leading-6 outline-none focus:border-[#c9a94f] focus:ring-2 focus:ring-[#c9a94f]/20"
                />
                <span className="mt-1 block text-right text-[11px] text-[#8a7a70]">{form.content.length.toLocaleString()} / 50,000</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-[#5f514a]">
                <input
                  type="checkbox"
                  checked={form.is_published}
                  onChange={(event) => setForm((current) => ({ ...current, is_published: event.target.checked }))}
                  className="h-4 w-4 accent-[#92701e]"
                />
                Published and visible to customers
              </label>

              {error && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
              {notice && <p role="status" className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}

              <div className="flex flex-wrap justify-between gap-3 border-t border-[#eee6de] pt-4">
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="inline-flex items-center gap-2 rounded-md bg-[#33251e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#5b4540] disabled:opacity-60"
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : pageDeleted ? <RotateCcw size={16} /> : <Save size={16} />}
                  {pageDeleted ? "Restore and save" : "Save page"}
                </button>
                {selectedPage && !pageDeleted && (
                  <button
                    type="button"
                    disabled={saving || loading}
                    onClick={deletePage}
                    className="inline-flex items-center gap-2 rounded-md border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 size={16} /> Delete page
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
