import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CalendarDays,
  Cake,
  ChevronRight,
  Heart,
  Mail,
  MapPin,
  MapPinned,
  Phone,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UserRound,
} from 'lucide-react';
import PageShell from '../components/PageShell';

export default function Profile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }
  }, []);

  const fullName = user?.name || 'Not available';
  const firstName = fullName.split(' ')[0];

  const defaultAddress = user?.address || user?.default_address || 'Not set';
  const addressParts = (defaultAddress || '').split(',').map((p) => p.trim()).filter(Boolean);
  const country = addressParts[addressParts.length - 1] || 'Not set';
  const city = addressParts[addressParts.length - 2] || 'Not set';
  const postalCode = user?.postal_code || '—';

  return (
    <PageShell background="bg-[#fafaf9]" padding="px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10" innerClassName="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.32em] text-[#c59a36]">My Profile</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[30px]">Account Overview</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Keep your contact details and delivery information ready for every order.
          </p>
        </div>
        <Link
          to="/customer/account-settings"
          className="inline-flex w-fit items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#c59a36] hover:text-slate-900"
        >
          <Settings size={15} />
          Account Settings
        </Link>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
        {/* Profile header strip */}
        <div className="relative overflow-hidden bg-[#171717] px-5 py-6 sm:px-8 sm:py-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[18px] border-[#c59a36]/20" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-white/10 ring-2 ring-[#d4af37]/60">
            {user?.avatar ? (
              <img src={user.avatar} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl font-semibold text-white">
                {firstName?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold text-white">{fullName}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#d4af37]/15 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#f2d77c]">
                <ShieldCheck size={12} /> {user?.role || 'Customer'}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-white/65">
              <MapPin size={14} className="shrink-0 text-[#d4af37]" />
              {defaultAddress}
            </p>
          </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="border-b border-stone-100 px-5 py-6 sm:px-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c59a36]">Your details</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">Personal Information</h2>
            </div>
            <Link to="/customer/account-settings" className="text-xs font-bold text-slate-500 transition hover:text-slate-900">Edit</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field icon={UserRound} label="Full Name" value={fullName} />
            <Field icon={Mail} label="Email Address" value={user?.email || 'Not available'} />
            <Field icon={Phone} label="Phone Number" value={user?.phone || 'Not available'} />
            <Field icon={CalendarDays} label="Date of Birth" value={user?.dob || '—'} />
            <Field icon={ShieldCheck} label="Account Role" value={user?.role || 'Customer'} />
          </div>
        </div>

        {/* Address */}
        <div className="px-5 py-6 sm:px-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c59a36]">Delivery</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">Address</h2>
            </div>
            <Link to="/customer/saved-addresses" className="text-xs font-bold text-slate-500 transition hover:text-slate-900">Manage</Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field icon={MapPinned} label="Default Address" value={defaultAddress} wide />
            <Field icon={MapPin} label="Country" value={country} />
            <Field icon={MapPin} label="City" value={city} />
            <Field icon={MapPinned} label="Postal Code" value={postalCode} />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.03)] sm:p-6">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c59a36]">Shortcuts</p>
          <h2 className="mt-1 text-base font-bold text-slate-900">Quick Links</h2>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink to="/customer/orders" icon={ShoppingBag} title="My Orders" description="Track recent purchases" />
          <QuickLink to="/customer/customized-cakes" icon={Cake} title="Custom Cakes" description="View cake requests" />
          <QuickLink to="/customer/favorites" icon={Heart} title="Favorites" description="See saved products" />
          <QuickLink to="/customer/saved-addresses" icon={MapPinned} title="Saved Addresses" description="Manage delivery locations" />
          <QuickLink to="/customer/account-settings" icon={Settings} title="Account Settings" description="Update preferences" />
        </div>
      </section>
    </PageShell>
  );
}

function Field({ icon: Icon, label, value, wide = false }) {
  return (
    <div className={`${wide ? 'sm:col-span-2 lg:col-span-1' : ''} rounded-2xl border border-stone-100 bg-[#fafaf9] px-3.5 py-3`}>
      <div className="flex items-center gap-2 text-slate-400">
        {Icon && <Icon size={14} className="text-[#c59a36]" />}
        <p className="text-[9px] font-bold uppercase tracking-[0.16em]">{label}</p>
      </div>
      <p className="mt-2 break-words text-[13px] font-semibold leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function QuickLink({ to, icon: Icon, title, description }) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-2xl border border-stone-200 px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-[#d4af37] hover:bg-[#fffaf0]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f7edcf] text-[#a77b16] transition group-hover:bg-[#d4af37] group-hover:text-slate-900">
        <Icon size={17} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-slate-900">{title}</span>
        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-900" />
    </Link>
  );
}