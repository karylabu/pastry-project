import React, { useEffect, useState } from 'react';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE } from '../../services/config';
import { getAuthHeaders, safeParseJson } from '../../services/api';
import { Gift, Sparkles, ChevronRight, CheckCircle2, Clock3, BadgePercent } from 'lucide-react';

export default function Rewards() {
  const [user, setUser] = useState(null);
  const [loyalty, setLoyalty] = useState({ balance: 0, rewards: [], history: [] });
  const [redeeming, setRedeeming] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem('user') || 'null'));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${CUSTOMER_BASE}/api/loyalty`, { credentials: 'include', headers: getAuthHeaders() })
      .then(async (response) => {
        const data = await safeParseJson(response);
        if (!response.ok || !data.success) {
          throw new Error(data.message || 'Could not load your rewards.');
        }
        setLoyalty(data);
      })
      .catch((error) => {
        console.error('Could not load rewards:', error);
        setLoadError(error.message);
      });
  }, [user?.id]);

  const redeemPoints = async () => {
    if (loyalty.balance < 1000 || redeeming || !user?.id) return;
    setRedeeming(true);
    setRewardMessage('');
    try {
      const body = new URLSearchParams({ action: 'redeem', points: '1000' });
      const response = await fetch(`${CUSTOMER_BASE}/api/loyalty/redeem`, { method: 'POST', credentials: 'include', headers: getAuthHeaders(), body });
      const data = await safeParseJson(response);
      if (!response.ok) throw new Error(data.message || 'Unable to redeem points.');
      if (!data.success) throw new Error(data.message || 'Unable to redeem points.');
      setRewardMessage(`${data.reward_code}: 5% off, maximum ₱100 discount`);
      const refreshedResponse = await fetch(`${CUSTOMER_BASE}/api/loyalty`, { credentials: 'include', headers: getAuthHeaders() });
      const refreshed = await safeParseJson(refreshedResponse);
      if (!refreshedResponse.ok || !refreshed.success) {
        throw new Error(refreshed.message || 'Reward redeemed, but the updated balance could not be loaded.');
      }
      setLoyalty(refreshed);
    } catch (error) {
      setRewardMessage(error.message);
    } finally {
      setRedeeming(false);
    }
  };

  const pointsBalance = Math.min(Number(loyalty.balance) || 0, 1000);
  const pointsRemaining = Math.max(1000 - (Number(loyalty.balance) || 0), 0);
  const progressPercent = Math.min((pointsBalance / 1000) * 100, 100);

  return (
    <PageShell padding="px-4 py-4 sm:px-6 sm:py-8" innerClassName="space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-[#f0dfad] bg-[radial-gradient(circle_at_top,_#fffaf0_0%,_#f9f2dc_45%,_#f3ebd3_100%)] px-5 py-5 shadow-[0_20px_50px_rgba(120,84,20,0.08)] sm:rounded-[28px] sm:px-10 sm:py-10">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between sm:gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#a67c00] sm:text-[11px] sm:tracking-[0.38em]">My Rewards</p>
            <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 sm:mt-2 sm:text-4xl">Loyalty Points</h1>
            <p className="mt-2 max-w-xl text-sm leading-5 text-slate-600 sm:text-lg sm:leading-normal">Earn points from completed orders and redeem them for discounts on your next pastry fix.</p>
          </div>
          <div className="inline-flex items-center gap-2 self-start rounded-full border border-[#e7d399] bg-white/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8c6a1c] sm:py-2 sm:text-xs sm:tracking-[0.18em]">
            <Sparkles size={14} />
            10 points per ₱100
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-[#f0e5c0] bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.04)] sm:rounded-[28px] sm:p-8">
        {loadError && (
          <div role="alert" className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {loadError}
          </div>
        )}
        <div className="flex flex-col gap-4 sm:gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff3c4] text-[#a67c00] sm:h-11 sm:w-11 sm:rounded-2xl">
                <Gift size={18} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#a67c00] sm:text-[12px] sm:tracking-[0.32em]">Available balance</p>
                <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">{loyalty.balance} pts</h2>
              </div>
            </div>

            <p className="mt-3 text-sm font-semibold leading-5 text-slate-600 sm:mt-4 sm:text-lg sm:leading-normal">
              {pointsRemaining > 0 ? `${pointsRemaining} more points to unlock 5% OFF!` : 'You unlocked 5% OFF on your next order!'}
            </p>

            <div className="mt-4 max-w-xl sm:mt-5">
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500 sm:mb-2 sm:text-[12px] sm:tracking-[0.2em]">
                <span>Progress</span>
                <span className="text-base font-black text-slate-700 sm:text-lg">{Math.min(Math.round(progressPercent), 100)}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#f8f3e5] ring-1 ring-[#e8d79b] sm:h-3">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#d4af37_0%,#f3d36c_100%)] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-xl border border-[#f0e5c0] bg-[linear-gradient(180deg,#fffdf9_0%,#fff8e1_100%)] p-3 shadow-[0_18px_30px_rgba(122,94,31,0.08)] sm:rounded-[28px] sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f9eab2] text-[#8a6516] sm:h-12 sm:w-12 sm:rounded-2xl">
                <BadgePercent size={18} />
              </div>
              <div className="rounded-full border border-[#ead9a1] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#8c6a1c]">
                Best value
              </div>
            </div>

            <div className="mt-3 sm:mt-5">
              <p className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">5% OFF</p>
              <p className="mt-1 text-sm font-semibold text-slate-700 sm:mt-2 sm:text-base">1,000 Points Required</p>
            </div>

            <p className="mt-2 text-xs leading-4 text-slate-600 sm:mt-4 sm:text-sm sm:leading-6">Save 5% on your next order, up to ₱100.</p>

            <button
              type="button"
              onClick={redeemPoints}
              disabled={loyalty.balance < 1000 || redeeming}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#111827] px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-[#a67c00] disabled:cursor-not-allowed disabled:opacity-40 sm:mt-5 sm:rounded-2xl sm:px-5 sm:py-3 sm:tracking-[0.2em]"
            >
              {redeeming ? 'Redeeming...' : 'Redeem Reward'}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {rewardMessage && (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#dfe7c3] bg-[#f4f9ef] px-4 py-3 text-sm font-medium text-slate-700">
            <CheckCircle2 size={16} className="mt-0.5 text-[#3d7c2a]" />
            <span>{rewardMessage}</span>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.03)] sm:rounded-[28px] sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f0dc] text-[#8c6a1c]">
            <Clock3 size={18} />
          </div>
          <h2 className="text-[15px] font-semibold text-slate-900">Points history</h2>
        </div>

        {loyalty.history?.length > 0 ? (
          <div className="space-y-2.5">
            {loyalty.history.map((entry, index) => {
              const points = Number(entry.points || 0);
              const signed = points > 0 ? `+${points}` : `${points}`;
              const label = entry.label || (entry.type === 'redeem' ? 'Reward redeemed' : 'Order bonus');
              const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent';

              return (
                <div key={`${entry.type}-${entry.order_id ?? 'reward'}-${entry.created_at ?? index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-[#fafafa] px-4 py-3 text-sm sm:text-[15px]">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`shrink-0 font-black ${points >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {signed} pts
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate font-medium text-slate-700">{label}</span>
                      {entry.reward_code && (
                        <span className="block break-all text-xs font-semibold text-[#8c6a1c]">
                          Code: {entry.reward_code}{entry.order_id ? ' · Used' : ' · Unused'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500 sm:text-sm">{date}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-4 text-sm text-slate-500 sm:py-6 sm:text-[15px]">
            No rewards redeemed yet. Keep earning points to unlock your next discount.
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-[0_18px_40px_rgba(15,23,42,0.03)] sm:rounded-[28px] sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f0dc] text-[#8c6a1c]">
            <Sparkles size={18} />
          </div>
          <h2 className="text-[15px] font-semibold text-slate-900">How to earn points</h2>
        </div>

        <div className="grid gap-2 md:grid-cols-3 sm:gap-3">
          {[
            '🛍️ Complete an eligible paid order — Earn 10 points for every ₱100 spent.',
            '🎉 Check back after each completed order to grow your balance.',
            '🎁 Redeem once you reach 1,000 points for a 5% discount.',
          ].map((item) => (
            <div key={item} className="rounded-xl border border-gray-100 bg-[#fafafa] px-3 py-2.5 text-xs font-medium leading-5 text-slate-700 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-[15px]">
              {item}
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
