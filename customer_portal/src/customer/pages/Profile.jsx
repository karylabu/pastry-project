import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ') || '—';

  const defaultAddress = user?.address || user?.default_address || 'Not set';
  const addressParts = (defaultAddress || '').split(',').map((p) => p.trim()).filter(Boolean);
  const country = addressParts[addressParts.length - 1] || 'Not set';
  const city = addressParts[addressParts.length - 2] || 'Not set';
  const postalCode = user?.postal_code || '—';

  return (
    <PageShell innerClassName="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-gray-400 font-black mb-2">My Profile</p>
        <h1 className="text-[26px] font-bold tracking-tight text-slate-900">Account Overview</h1>
        <p className="mt-2 text-sm text-gray-400 max-w-2xl">
          Review your account information, delivery preferences, and profile settings all in one place.
        </p>
      </div>

      <div className="rounded-[24px] overflow-hidden border border-gray-100 shadow-sm bg-white">
        {/* Profile header strip */}
        <div className="bg-slate-900 px-6 py-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-white/10 flex items-center justify-center shrink-0 ring-2 ring-white/20">
            {user?.avatar ? (
              <img src={user.avatar} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-xl font-semibold">
                {firstName?.[0]?.toUpperCase() || 'U'}
              </span>
            )}
          </div>
          <div>
            <p className="text-white text-[16px] font-semibold">{fullName}</p>
            <p className="text-white/60 text-[13px] mt-0.5">{user?.role || 'Customer'}</p>
            <p className="text-white/60 text-[12px] mt-0.5">{defaultAddress}</p>
          </div>
        </div>

        {/* Personal Information */}
        <div className="px-6 py-6 border-b border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-slate-900">Personal Information</h2>
            <button className="text-[12px] font-semibold text-white bg-black px-4 py-1.5 rounded-full hover:bg-slate-800 transition">
              Edit
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5">
            <Field label="First Name" value={firstName || 'Not available'} />
            <Field label="Last Name" value={lastName} />
            <Field label="Date of Birth" value={user?.dob || '—'} />
            <Field label="Role" value={user?.role || 'Customer'} />
            <Field label="Email Address" value={user?.email || 'Not available'} />
            <Field label="Phone Number" value={user?.phone || 'Not available'} />
          </div>
        </div>

        {/* Address */}
        <div className="px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-slate-900">Address</h2>
            <button className="text-[12px] font-semibold text-white bg-black px-4 py-1.5 rounded-full hover:bg-slate-800 transition">
              Edit
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-5">
            <Field label="Default Address" value={defaultAddress} />
            <Field label="Country" value={country} />
            <Field label="City" value={city} />
            <Field label="Postal Code" value={postalCode} />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <section className="rounded-[24px] border border-gray-100 bg-white p-6">
        <h2 className="text-[15px] font-semibold mb-4 text-slate-900">Quick Links</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link to="/customer/orders" className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-slate-900 hover:border-black transition">My Orders</Link>
          <Link to="/customer/customized-cakes" className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-slate-900 hover:border-black transition">Customized Cake Orders</Link>
          <Link to="/customer/favorites" className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-slate-900 hover:border-black transition">Favorites</Link>
          <Link to="/customer/saved-addresses" className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-slate-900 hover:border-black transition">Saved Addresses</Link>
          <Link to="/customer/account-settings" className="block rounded-2xl border border-gray-200 px-4 py-3 text-sm font-medium text-slate-900 hover:border-black transition">Account Settings</Link>
        </div>
      </section>
    </PageShell>
  );
}

function Field({ label, value }) {
  return (
    <div>
      <p className="text-gray-400 uppercase tracking-[0.2em] text-[10px] font-semibold">{label}</p>
      <p className="mt-1 font-medium text-slate-900 text-[13px]">{value}</p>
    </div>
  );
}