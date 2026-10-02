import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, RefreshCw, Star } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

function formatReviewDate(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function Reviews() {
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    fetch(`${LARAVEL_BASE}/api/admin/reviews?page=${page}`, {
      credentials: "include",
      headers: { Accept: "application/json", ...getAuthHeaders() },
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.message || "Unable to load customer reviews.");
        return data;
      })
      .then((data) => {
        if (!active) return;
        setReviews(Array.isArray(data.reviews) ? data.reviews : []);
        setLastPage(Math.max(1, Number(data.last_page) || 1));
        setTotal(Number(data.total) || 0);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError.message || "Unable to load customer reviews.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [page, reloadKey]);

  const pageAverage = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;
  const fiveStarCount = reviews.filter((review) => Number(review.rating) === 5).length;
  const firstReview = total ? (page - 1) * 20 + 1 : 0;
  const lastReview = Math.min(page * 20, total);

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div className="pt-[72px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-5 flex flex-col gap-4 border-b border-[#e8dfd4] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#fff4cd] text-[#9b7810]">
                <MessageSquare size={17} />
              </span>
              <div className="min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Business analytics</p>
                <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Customer Reviews</h1>
                <p className="mt-1.5 text-[13px] text-[#74675f]">Customer feedback from completed orders.</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="text-[11px] font-semibold text-[#74675f]" aria-live="polite">
                {total.toLocaleString()} {total === 1 ? "review" : "reviews"}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((current) => current + 1)}
                disabled={loading}
                aria-label="Refresh reviews"
                title="Refresh reviews"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#e8dfd4] bg-white text-[#65574d] transition hover:border-[#c9a94f] hover:bg-[#fffaf0] disabled:cursor-wait disabled:opacity-50"
              >
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="mb-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <div className="rounded-lg border border-[#e9e1d9] border-t-[3px] border-t-[#d4af37] bg-white px-4 py-3.5 shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#74675f]">Total reviews</p>
              <p className="mt-2 text-[25px] font-bold leading-none text-[#33251e]">{total.toLocaleString()}</p>
              <p className="mt-1.5 text-[10px] text-[#9b8c83]">All submitted feedback</p>
            </div>
            <div className="rounded-lg border border-[#e9e1d9] border-t-[3px] border-t-[#81906c] bg-white px-4 py-3.5 shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#74675f]">Average rating · this page</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="text-[25px] font-bold leading-none text-[#33251e]">{reviews.length ? pageAverage.toFixed(1) : "—"}</p>
                <Star size={15} className="fill-[#d4af37] text-[#d4af37]" />
                <span className="text-[11px] text-[#8f8076]">/ 5</span>
              </div>
              <p className="mt-1.5 text-[10px] text-[#9b8c83]">Based on reviews currently shown</p>
            </div>
            <div className="rounded-lg border border-[#e9e1d9] border-t-[3px] border-t-[#c87954] bg-white px-4 py-3.5 shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#74675f]">5-star reviews · this page</p>
              <p className="mt-2 text-[25px] font-bold leading-none text-[#33251e]">{fiveStarCount}</p>
              <p className="mt-1.5 text-[10px] text-[#9b8c83]">Out of {reviews.length} reviews shown</p>
            </div>
          </div>

          {error ? (
            <div role="alert" className="mb-4 flex flex-col gap-3 rounded-lg border border-[#efd8d4] bg-[#fff0f0] px-4 py-3 text-[13px] text-[#8d5357] sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setReloadKey((current) => current + 1)} className="w-fit rounded-md border border-[#d9aaa4] px-3 py-2 text-[11px] font-semibold text-[#8d5357] transition hover:bg-white">Try again</button>
            </div>
          ) : null}

          {loading ? (
            <div className="overflow-hidden rounded-lg border border-[#e9e1d9] bg-white" role="status" aria-label="Loading reviews">
              <div className="border-b border-[#f0e9e2] px-4 py-4 sm:px-5">
                <div className="h-3 w-32 animate-pulse rounded bg-[#eee7df]" />
              </div>
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-3 border-b border-[#f0e9e2] px-4 py-5 last:border-0 sm:px-5">
                  <div className="h-10 w-10 shrink-0 animate-pulse rounded-lg bg-[#f3eee7]" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-40 animate-pulse rounded bg-[#eee7df]" />
                    <div className="h-2.5 w-52 max-w-full animate-pulse rounded bg-[#f3eee7]" />
                    <div className="h-3 w-full animate-pulse rounded bg-[#f3eee7]" />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {!loading && !error && !reviews.length ? (
            <div className="rounded-lg border border-dashed border-[#d9cdc3] bg-white px-5 py-14 text-center shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
              <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-[#fff4cd] text-[#9b7810]">
                <MessageSquare size={19} />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-[#33251e]">No customer reviews yet</p>
              <p className="mt-1 text-[12px] text-[#8f8076]">Submitted reviews will appear here.</p>
            </div>
          ) : null}

          {!loading && !error && reviews.length ? (
            <>
              <section className="overflow-hidden rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
                <div className="flex flex-col gap-1 border-b border-[#f0e9e2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div>
                    <h2 className="text-[13px] font-semibold text-[#33251e]">Latest feedback</h2>
                    <p className="mt-0.5 text-[11px] text-[#8f8076]">Most recent reviews first</p>
                  </div>
                  <span className="text-[10px] font-medium text-[#8f8076]">Showing {firstReview}–{lastReview} of {total.toLocaleString()}</span>
                </div>
                {reviews.map((review) => (
                  <article key={review.id} className="grid gap-3 border-b border-[#f0e9e2] px-4 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-5 sm:py-5">
                    <div className="flex min-w-0 gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f3eee7] text-[12px] font-bold text-[#806f61]">
                        {(review.customer_name || "C").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <h3 className="text-[13px] font-semibold text-[#33251e]">{review.customer_name || "Customer"}</h3>
                          {review.customer_email ? <span className="break-all text-[11px] text-[#9b8c83]">{review.customer_email}</span> : null}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-[#8f8076]">
                          <span className="font-medium text-[#65574d]">Order #{review.order_id}</span>
                          <span aria-hidden="true" className="text-[#d1bfae]">·</span>
                          <time dateTime={review.created_at || undefined}>{formatReviewDate(review.created_at)}</time>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-5 text-[#5f514a]">{review.comment || "No written comment."}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-[52px] sm:flex-col sm:items-end sm:pl-0">
                      <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, index) => <Star key={index} size={13} className={index < Number(review.rating) ? "fill-[#d4af37] text-[#d4af37]" : "text-[#e5ddd5]"} />)}
                      </div>
                      <span className="text-[11px] font-semibold text-[#5f514a]">{review.rating}/5</span>
                    </div>
                  </article>
                ))}
                <div className="flex items-center justify-between gap-3 border-t border-[#f0e9e2] bg-[#fcfaf7] px-4 py-3 sm:px-5">
                  <span className="text-[11px] text-[#8f8076]">Page {page} of {lastPage}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} aria-label="Previous page" title="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#5f514a] transition hover:border-[#c9a94f] hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={17} /></button>
                    <button type="button" onClick={() => setPage((current) => Math.min(lastPage, current + 1))} disabled={page >= lastPage || loading} aria-label="Next page" title="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#5f514a] transition hover:border-[#c9a94f] hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={17} /></button>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}