import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MessageSquare, Star } from "lucide-react";
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
  }, [page]);

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div className="pt-[72px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[#e8dfd4] pb-5">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#92701e]">Business Analytics</p>
              <h1 className="text-[25px] font-bold leading-tight">Customer Reviews</h1>
              <p className="mt-1 text-[12px] text-[#74675f]">Reviews submitted for completed orders.</p>
            </div>
            <p className="text-[12px] font-semibold text-[#74675f]">{total.toLocaleString()} {total === 1 ? "review" : "reviews"}</p>
          </div>

          {error ? <div role="alert" className="rounded-lg border border-[#efd8d4] bg-[#fff0f0] px-4 py-3 text-[13px] text-[#8d5357]">{error}</div> : null}
          {loading ? <div className="rounded-lg border border-[#eadfd8] bg-white px-5 py-10 text-center text-[13px] text-[#9b8c83]">Loading reviews...</div> : null}
          {!loading && !error && !reviews.length ? (
            <div className="rounded-lg border border-dashed border-[#d9cdc3] bg-white px-5 py-14 text-center">
              <MessageSquare size={24} className="mx-auto text-[#b7a69c]" />
              <p className="mt-3 text-[14px] font-semibold text-[#5f514a]">No customer reviews yet</p>
            </div>
          ) : null}

          {!loading && !error && reviews.length ? (
            <>
              <div className="divide-y divide-[#eee5de] border-y border-[#eee5de] bg-white">
                {reviews.map((review) => (
                  <article key={review.id} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <h2 className="text-[13px] font-semibold text-[#4b3930]">{review.customer_name || "Customer"}</h2>
                        {review.customer_email ? <span className="break-all text-[11px] text-[#9b8c83]">{review.customer_email}</span> : null}
                      </div>
                      <p className="mt-1 text-[11px] text-[#8f8076]">Order #{review.order_id} <span className="px-1">·</span> {formatReviewDate(review.created_at)}</p>
                      <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-5 text-[#5f514a]">{review.comment || "No written comment."}</p>
                    </div>
                    <div className="flex items-start justify-between gap-3 sm:flex-col sm:items-end">
                      <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                        {Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} className={index < Number(review.rating) ? "fill-[#d4af37] text-[#d4af37]" : "text-[#e5ddd5]"} />)}
                        <span className="ml-1 text-[11px] font-semibold text-[#5f514a]">{review.rating}/5</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[11px] text-[#8f8076]">Page {page} of {lastPage}</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1 || loading} aria-label="Previous page" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#5f514a] disabled:opacity-40"><ChevronLeft size={17} /></button>
                  <button type="button" onClick={() => setPage((current) => Math.min(lastPage, current + 1))} disabled={page >= lastPage || loading} aria-label="Next page" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#5f514a] disabled:opacity-40"><ChevronRight size={17} /></button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}