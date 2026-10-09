import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
  AtSign,
  UserRound,
} from 'lucide-react';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE } from '../../services/config';
import { getAuthHeaders, safeParseJson } from '../../services/api';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [savedDefaultAddress, setSavedDefaultAddress] = useState(null);
  const [failedAvatarUrl, setFailedAvatarUrl] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {
      setUser(null);
    }

    fetch(`${CUSTOMER_BASE}/api/user`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(safeParseJson)
      .then((data) => {
        if (data?.id) {
          const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
          const syncedUser = {
            ...currentUser,
            ...data,
            avatar: data.avatar || data.profile_image || data.profile_picture || currentUser.avatar || '',
          };
          setUser(syncedUser);
          localStorage.setItem('user', JSON.stringify(syncedUser));
        }
      })
      .catch(() => {
        // Keep the locally cached account visible when the profile request is unavailable.
      });

    fetch(`${CUSTOMER_BASE}/api/addresses`, {
      credentials: 'include',
      headers: getAuthHeaders(),
    })
      .then(safeParseJson)
      .then((data) => {
        if (data?.status === 'success' && Array.isArray(data.addresses)) {
          setSavedDefaultAddress(data.addresses.find((address) => address.is_default) || null);
        }
      })
      .catch(() => {
        // The legacy profile address remains visible if saved addresses are unavailable.
      });
  }, []);

  const fullName = user?.name || 'Not available';
  const firstName = fullName.split(' ')[0];
  const avatarUrl = user?.avatar || user?.profile_image || user?.profile_picture || '';

  const savedAddressParts = savedDefaultAddress
    ? [
        savedDefaultAddress.house_no,
        savedDefaultAddress.street,
        savedDefaultAddress.barangay,
        savedDefaultAddress.city,
        savedDefaultAddress.province,
        savedDefaultAddress.zip_code,
      ].filter(Boolean)
    : [];
  const defaultAddress = savedAddressParts.join(', ') || user?.address || user?.default_address || 'Not set';
  return (
    <PageShell background="bg-[#fffaf3]" padding="px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10" innerClassName="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-black uppercase tracking-[0.32em] text-[#c59a36]">My Profile</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[30px]">Account Overview</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
            Keep your contact details and address ready for every order.
          </p>
        </div>
        <Link
          to="/customer/account-settings"
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-[#e7c878] bg-[#fff4cf] px-4 py-2.5 text-xs font-bold text-[#6b4a2e] transition hover:bg-[#f1cf72]"
        >
          <Settings size={15} />
          Account Settings
        </Link>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.05)]">
        {/* Profile header strip */}
        <div className="relative overflow-hidden bg-[#fff7df] px-5 py-6 sm:px-8 sm:py-8">
          <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[18px] border-[#e7c878]/45" />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[22px] bg-white ring-2 ring-[#e7c878] shadow-sm">
            {avatarUrl && failedAvatarUrl !== avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-full h-full object-cover"
                onError={() => setFailedAvatarUrl(avatarUrl)}
              />
            ) : (
              <span className="text-2xl font-semibold text-[#8b5e34]">
                {firstName?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xl font-bold text-[#4a2b20]">{fullName}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#f1cf72]/35 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.16em] text-[#8b5e34]">
                <ShieldCheck size={12} /> {user?.role || 'Customer'}
              </span>
            </div>
            <p className="mt-2 flex items-center gap-1.5 truncate text-sm text-[#8b6b55]">
              <MapPin size={14} className="shrink-0 text-[#c59a36]" />
              {defaultAddress}
            </p>
          </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="border-b border-[#f0e4d5] px-5 py-6 sm:px-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c59a36]">Your details</p>
              <h2 className="mt-1 text-base font-bold text-slate-900">Personal Information</h2>
            </div>
            <Link
              to="/customer/account-settings?section=profile"
              className="text-xs font-bold text-slate-500 transition hover:text-slate-900"
            >
              Edit
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field icon={UserRound} label="Full Name" value={fullName} />
            <Field icon={AtSign} label="Username" value={user?.username ? `@${user.username}` : 'Not available'} />
            <Field icon={Mail} label="Email Address" value={user?.email || 'Not available'} />
            <Field icon={Phone} label="Phone Number" value={user?.phone || user?.phone_number || user?.mobile || 'Not available'} />
          </div>
        </div>

        {/* Address */}
        <div id="address" className="scroll-mt-6 bg-[#fffdfa] px-5 py-6 sm:px-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Address</h2>
            </div>
            <Link
              to="/customer/account-settings?section=profile#address"
              className="text-xs font-bold text-slate-500 transition hover:text-slate-900"
            >
              Edit
            </Link>
          </div>
          <div className="grid gap-3">
            <Field icon={MapPinned} label="Address" value={defaultAddress} wide />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <section className="rounded-[24px] border border-[#eadfce] bg-[#fffdfa] p-5 shadow-[0_10px_28px_rgba(126,82,35,0.06)] sm:p-6">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c59a36]">Shortcuts</p>
          <h2 className="mt-1 text-base font-bold text-slate-900">Quick Links</h2>
        </div>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink to="/customer/orders" icon={ShoppingBag} title="My Orders" description="Track recent purchases" />
          <QuickLink to="/customer/customized-cakes" icon={Cake} title="Custom Cakes" description="View cake requests" />
          <QuickLink to="/customer/favorites" icon={Heart} title="Favorites" description="See saved products" />
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