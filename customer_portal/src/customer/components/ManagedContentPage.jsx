import React, { useEffect, useState } from "react";
import { LARAVEL_BASE } from "../../services/config";

export default function ManagedContentPage({ slug, fallback }) {
  const [page, setPage] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setPage(null);
    setUnavailable(false);

    fetch(`${LARAVEL_BASE}/api/content-pages/${encodeURIComponent(slug)}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 410) {
          setUnavailable(true);
          return null;
        }
        if (!response.ok) return null;
        const data = await response.json();
        return data.success ? data.data : null;
      })
      .then((contentPage) => {
        if (contentPage) setPage(contentPage);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setPage(null);
        }
      });

    return () => controller.abort();
  }, [slug]);

  if (unavailable) {
    return (
      <main className="min-h-[60vh] bg-[#fffaf3] px-5 py-20 text-center text-[#33251e]">
        <h1 className="text-3xl font-bold">Page unavailable</h1>
        <p className="mt-3 text-sm text-[#75675f]">This page is currently unavailable.</p>
      </main>
    );
  }

  if (!page?.content?.trim()) return fallback;

  return (
    <main className="min-h-[60vh] bg-[#fffaf3] px-5 py-12 text-[#33251e] sm:px-8">
      <article className="mx-auto max-w-4xl">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-[#92701e]">Pastry Project</p>
        <h1 className="text-3xl font-bold sm:text-4xl">{page.title}</h1>
        <div className="mt-8 whitespace-pre-wrap break-words text-sm leading-7 text-[#55473f] sm:text-base">
          {page.content}
        </div>
      </article>
    </main>
  );
}
