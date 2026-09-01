import React, { useEffect, useState } from 'react';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';
import { Gift, Sparkles, Ticket, ChevronRight, CheckCircle2, Clock3, Truck, BadgePercent } from 'lucide-react';

export default function Rewards() {
  const [user, setUser] = useState(null);
  const [loyalty, setLoyalty] = useState({ balance: 0, rewards: [], history: [] });
  const [redeeming, setRedeeming] = useState(false);
  const [rewardMessage, setRewardMessage] = useState('');

  useEffect(() => {
    try {
      setUser(JSON.parse(localStorage.getItem('user') || 'null'));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${CUSTOMER_BASE}/api_loyalty.php?user_id=${user.id}`)
      .then((response) => safeParseJson(response))
      .then((data) => {
        if (data.success) setLoyalty(data);
      })
      .catch(() => setLoyalty({ balance: 0, rewards: [] }));
  }, [user?.id]);

  const redeemPoints = async () => {
    if (loyalty.balance < 1000 || redeeming || !user?.id) return;
    setRedeeming(true);
    setRewardMessage('');
    try {
      const body = new URLSearchParams({ user_id: String(user.id), action: 'redeem', points: '1000' });
      const data = await safeParseJson(await fetch(`${CUSTOMER_BASE}/api_loyalty.php`, { method: 'POST', body }));
      if (!data.success) throw new Error(data.message || 'Unable to redeem points.');
      setRewardMessage(`${data.reward_code}: 5% off, maximum ₱100 discount`);
      const refreshed = await safeParseJson(await fetch(`${CUSTOMER_BASE}/api_loyalty.php?user_id=${user.id}`));
      if (refreshed.success) setLoyalty(refreshed);
    } catch (error) {
      setRewardMessage(error.message);
    } finally {
      setRedeeming(false);
    }
  };

  const pointsBalance = Math.min(Number(loyalty.balance) || 0, 1000);
  const pointsRemaining = Math.max(1000 - (Number(loyalty.balance) || 0), 0);
  const progressPercent = Math.min((pointsBalance / 1000) * 100, 100);

  const rewardTiers = [
    { label: 'Free Delivery', required: 500, icon: Truck },
    { label: '5% OFF', required: 1000, icon: BadgePercent },
    { label: '10% OFF', required: 2000, icon: Ticket },
  ];

  const formatPoints = (value) => `${value > 0 ? '+' : ''}${value} pts`;

  return (
    <PageShell innerClassName="space-y-6">
      <div className="rounded-[28px] border border-[#f0dfad] bg-[radial-gradient(circle_at_top,_#fffaf0_0%,_#f9f2dc_45%,_#f3ebd3_100%)] px-6 py-8 shadow-[0_20px_50px_rgba(120,84,20,0.08)] sm:px-10 sm:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.38em] text-[#a67c00]">My Rewards</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">Loyalty Points</h1>
            <p className="mt-2 max-w-xl text-base text-slate-600 sm:text-lg">Earn points from completed orders and redeem them for discounts on your next pastry fix.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e7d399] bg-white/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[#8c6a1c]">
            <Sparkles size={14} />
            10 points per ₱100
          </div>
        </div>
      </div>

      <section className="rounded-[28px] border border-[#f0e5c0] bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.04)] sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff3c4] text-[#a67c00]">
                <Gift size={20} />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[#a67c00] sm:text-[12px]">Available balance</p>
                <h2 className="mt-1 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">{loyalty.balance} pts</h2>
              </div>
            </div>

            <p className="mt-4 text-base font-semibold text-slate-600 sm:text-lg">
              {pointsRemaining > 0 ? `${pointsRemaining} more points to unlock 5% OFF!` : 'You unlocked 5% OFF on your next order!'}
            </p>

            <div className="mt-5 max-w-xl">
              <div className="mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 sm:text-[12px]">
                <span>Progress</span>
                <span className="text-base font-black text-slate-700 sm:text-lg">{Math.min(Math.round(progressPercent), 100)}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-[#f8f3e5] ring-1 ring-[#e8d79b]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#d4af37_0%,#f3d36c_100%)] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          </div>

          <div className="w-full max-w-sm rounded-[28px] border border-[#f0e5c0] bg-[linear-gradient(180deg,#fffdf9_0%,#fff8e1_100%)] p-5 shadow-[0_18px_30px_rgba(122,94,31,0.08)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f9eab2] text-[#8a6516]">
                <BadgePercent size={20} />
              </div>
              <div className="rounded-full border border-[#ead9a1] bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#8c6a1c]">
                Best value
              </div>
            </div>

            <div className="mt-5">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#a67c00]">Featured reward</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">5% OFF</p>
              <p className="mt-2 text-base font-semibold text-slate-700">1,000 Points Required</p>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">Enjoy a 5% discount on your next order, with a maximum ₱100 discount cap.</p>

            <button
              type="button"
              onClick={redeemPoints}
              disabled={loyalty.balance < 1000 || redeeming}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#111827] px-5 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#a67c00] disabled:cursor-not-allowed disabled:opacity-40"
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

      <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.03)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f0dc] text-[#8c6a1c]">
            <Gift size={18} />
          </div>
          <h2 className="text-[15px] font-semibold text-slate-900">Available rewards</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {rewardTiers.map(({ label, required, icon: Icon }) => {
            const reachable = Number(loyalty.balance) >= required;
            const remaining = Math.max(required - Number(loyalty.balance || 0), 0);
            const progress = Math.min((Number(loyalty.balance || 0) / required) * 100, 100);

            return (
              <div key={label} className="rounded-2xl border border-[#f0e5c0] bg-[#fffaf1] p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#8c6a1c] ring-1 ring-[#eedaa0]">
                  <Icon size={18} />
                </div>
                <p className="mt-4 text-lg font-black text-slate-900">{label}</p>
                <p className="mt-1 text-sm font-medium text-slate-600">{required} pts</p>

                <div className="mt-3 rounded-xl border border-[#f3e3b0] bg-white/80 px-2.5 py-2">
                  <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.12em] text-slate-600">
                    <span>{reachable ? '🔓 Available' : '🔒'} {reachable ? 'Available' : `${remaining} pts more`}</span>
                    <span>{reachable ? '100%' : `${Math.min(Math.round(progress), 100)}%`}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f8f3e5]">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#d4af37_0%,#f3d36c_100%)]" style={{ width: `${Math.min(progress, 100)}%` }} />
                  </div>
                  <p className="mt-2 text-[11px] font-semibold text-slate-500">Progress: {Math.min(Number(loyalty.balance || 0), required)} / {required}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.03)]">
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
                    <span className={`font-black ${points >= 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                      {signed} pts
                    </span>
                    <span className="truncate font-medium text-slate-700">{label}</span>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-500 sm:text-sm">{date}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-slate-500 sm:text-[15px]">
            No rewards redeemed yet. Keep earning points to unlock your next discount.
          </div>
        )}
      </section>

      <section className="rounded-[28px] border border-gray-100 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.03)]">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f7f0dc] text-[#8c6a1c]">
            <Sparkles size={18} />
          </div>
          <h2 className="text-[15px] font-semibold text-slate-900">How to earn points</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[
            '🛍️ Complete a paid order — Earn 1 point for every ₱100 spent.',
            '🎉 Check back after each completed order to grow your balance.',
            '🎁 Redeem once you reach 1,000 points for a 5% discount.',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-gray-100 bg-[#fafafa] px-4 py-3 text-sm font-medium text-slate-700 sm:text-[15px]">
              {item}
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}
