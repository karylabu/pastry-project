import React, { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';
import { BriefcaseBusiness, Check, ChevronRight, GraduationCap, Home, MapPin, Pencil, Save } from 'lucide-react';

const LABELS = ['Home', 'Work', 'School', 'Other'];
const LABEL_ICONS = { Home, Work: BriefcaseBusiness, School: GraduationCap, Other: MapPin };

export default function SavedAddresses() {
  const [addresses, setAddresses] = useState([]);
  const [form, setForm] = useState({
    address_id: 0,
    address_label: 'Home',
    recipient_name: '',
    contact_number: '',
    house_no: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    zip_code: '',
    landmark: '',
    delivery_instructions: '',
    is_default: false,
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profileUser, setProfileUser] = useState(null);
  const formSectionRef = useRef(null);

  const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
  const userId = storedUser ? JSON.parse(storedUser).id : 0;

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const parsedUser = JSON.parse(localStorage.getItem('user') || 'null');
        setProfileUser(parsedUser);
      } catch {
        setProfileUser(null);
      }
    }

    if (userId > 0) {
      fetchAddresses();
    }
  }, [userId]);

  const buildProfileAddressPreview = (user) => {
    const rawAddress = user?.address || user?.default_address || '';
    if (!rawAddress) return null;

    const parts = rawAddress.split(',').map((part) => part.trim()).filter(Boolean);
    const [street = '', barangay = '', city = '', province = '', ...rest] = parts;
    const zipCode = user?.postal_code || rest[0] || '';

    return {
      address_label: 'Home',
      recipient_name: user?.name || '',
      contact_number: user?.phone || '',
      house_no: '',
      street,
      barangay,
      city,
      province,
      zip_code: zipCode,
      landmark: '',
      delivery_instructions: '',
      is_default: true,
    };
  };

  const fetchAddresses = async () => {
    try {
      const res = await fetch(`${CUSTOMER_BASE}/api_addresses.php?user_id=${userId}`);
      const data = await safeParseJson(res);
      if (data?.status === 'success') {
        const fetchedAddresses = data.addresses || [];
        setAddresses(fetchedAddresses);

        if (fetchedAddresses.length === 0 && profileUser) {
          const preview = buildProfileAddressPreview(profileUser);
          if (preview) {
            setForm((prev) => ({ ...prev, ...preview }));
            setAddresses([{ address_id: 0, ...preview }]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load addresses', err);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    const requiredFields = ['recipient_name', 'contact_number', 'street', 'barangay', 'city', 'province'];
    for (const field of requiredFields) {
      if (!form[field]?.trim()) {
        setError('Please fill in all required fields.');
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch(`${CUSTOMER_BASE}/api_addresses.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, user_id: userId }),
      });
      const data = await safeParseJson(res);
      if (data?.status === 'success') {
        const nextAddresses = data.addresses || [];
        setAddresses(nextAddresses);
        setMessage('Address saved successfully.');

        if (form.is_default || nextAddresses.some((address) => address.is_default)) {
          const savedAddress = nextAddresses.find((address) => address.is_default) || nextAddresses[0];
          const defaultAddressString = [
            savedAddress?.house_no,
            savedAddress?.street,
            savedAddress?.barangay,
            savedAddress?.city,
            savedAddress?.province,
            savedAddress?.zip_code,
          ].filter(Boolean).join(', ');

          if (typeof window !== 'undefined' && profileUser) {
            const updatedUser = {
              ...profileUser,
              address: defaultAddressString,
              default_address: defaultAddressString,
              postal_code: savedAddress?.zip_code || profileUser?.postal_code || '',
            };
            localStorage.setItem('user', JSON.stringify(updatedUser));
            setProfileUser(updatedUser);
          }
        }

        setForm({
          address_id: 0,
          address_label: 'Home',
          recipient_name: '',
          contact_number: '',
          house_no: '',
          street: '',
          barangay: '',
          city: '',
          province: '',
          zip_code: '',
          landmark: '',
          delivery_instructions: '',
          is_default: false,
        });
      } else {
        setError(data.message || 'Unable to save address.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (address) => {
    setMessage('');
    setError('');
    setForm({
      address_id: address.address_id,
      address_label: address.address_label,
      recipient_name: address.recipient_name,
      contact_number: address.contact_number,
      house_no: address.house_no || '',
      street: address.street,
      barangay: address.barangay,
      city: address.city,
      province: address.province,
      zip_code: address.zip_code || '',
      landmark: address.landmark || '',
      delivery_instructions: address.delivery_instructions || '',
      is_default: address.is_default,
    });

    window.setTimeout(() => {
      formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  return (
    <PageShell background="bg-[#fafaf9]" padding="px-4 py-6 sm:px-6 sm:py-8 md:px-10 md:py-10" innerClassName="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#c59a36]">Delivery Details</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-[30px]">Saved Addresses</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Save your usual delivery locations for a faster, smoother checkout.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-[#eadfbf] bg-[#fffaf0] px-3 py-2 text-xs font-semibold text-[#8b681d]">
            <MapPin size={15} />
            Delivery-ready locations
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section ref={formSectionRef} className="space-y-7 rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.04)] sm:p-7">
            <div className="flex items-start justify-between gap-4 border-b border-stone-100 pb-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#c59a36]">Address book</p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">{form.address_id ? 'Edit address' : 'Add a new address'}</h2>
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f7edcf] text-[#a77b16]"><Home size={17} /></span>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Address label</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {LABELS.map((label) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => handleChange('address_label', label)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${form.address_label === label ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-stone-200 bg-[#fafaf9] text-slate-700 hover:border-[#d4af37]'}`}
                  >
                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${form.address_label === label ? 'bg-[#d4af37] text-slate-900' : 'bg-white text-[#a77b16]'}`}>
                      {React.createElement(LABEL_ICONS[label], { size: 16 })}
                    </span>
                    <span className="flex-1">{label}</span>
                    {form.address_label === label && <Check size={16} />}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Recipient information</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">Full Name</span>
                  <input
                    value={form.recipient_name}
                    onChange={(e) => handleChange('recipient_name', e.target.value)}
                    placeholder="Recipient name"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">Contact Number</span>
                  <input
                    value={form.contact_number}
                    onChange={(e) => handleChange('contact_number', e.target.value)}
                    placeholder="09XXXXXXXXX"
                    type="tel"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Address details</p>
              <div className="grid gap-4">
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">House/Building Number</span>
                  <input
                    value={form.house_no}
                    onChange={(e) => handleChange('house_no', e.target.value)}
                    placeholder="House/Building number"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">Street Name</span>
                  <input
                    value={form.street}
                    onChange={(e) => handleChange('street', e.target.value)}
                    placeholder="Street name"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">Barangay</span>
                  <input
                    value={form.barangay}
                    onChange={(e) => handleChange('barangay', e.target.value)}
                    placeholder="Barangay"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">City/Municipality</span>
                  <input
                    value={form.city}
                    onChange={(e) => handleChange('city', e.target.value)}
                    placeholder="City or municipality"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">Province</span>
                  <input
                    value={form.province}
                    onChange={(e) => handleChange('province', e.target.value)}
                    placeholder="Province"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
                <label className="block text-sm text-gray-700">
                  <span className="font-semibold">ZIP/Postal Code</span>
                  <input
                    value={form.zip_code}
                    onChange={(e) => handleChange('zip_code', e.target.value)}
                    placeholder="ZIP / Postal code"
                    className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Additional information</p>
              <label className="block text-sm text-gray-700">
                <span className="font-semibold">Landmark (optional)</span>
                <input
                  value={form.landmark}
                  onChange={(e) => handleChange('landmark', e.target.value)}
                  placeholder="Landmark"
                  className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                />
              </label>
              <label className="block text-sm text-gray-700">
                <span className="font-semibold">Delivery Instructions (optional)</span>
                <textarea
                  value={form.delivery_instructions}
                  onChange={(e) => handleChange('delivery_instructions', e.target.value)}
                  placeholder="Leave at the guardhouse or call upon arrival"
                  rows={4}
                  className="mt-2 w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm outline-none focus:border-black"
                />
              </label>
            </div>

            <label className="flex items-center gap-3 rounded-2xl border border-[#eadfbf] bg-[#fffaf0] px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => handleChange('is_default', e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-[#d4af37] focus:ring-[#d4af37]"
              />
              <span className="font-semibold">Set as default address</span>
            </label>

            {message && <div className="rounded-3xl border border-green-100 bg-green-50 px-5 py-4 text-sm text-green-700">{message}</div>}
            {error && <div className="rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#d4af37] hover:text-slate-900 disabled:opacity-60"
            >
              <Save size={15} />
              {loading ? 'Saving…' : form.address_id ? 'Update Address' : 'Save Address'}
            </button>
          </section>

          <aside className="space-y-4 lg:sticky lg:top-24">
            <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-[0_12px_35px_rgba(15,23,42,0.04)] sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#c59a36]">Your locations</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-900">Saved Addresses</h2>
                </div>
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{addresses.length}</span>
              </div>
              {addresses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-[#fafaf9] p-5 text-center">
                  <MapPin size={22} className="mx-auto text-[#c59a36]" />
                  <p className="mt-2 text-sm font-semibold text-slate-800">No saved addresses yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Add one using the form to speed up checkout.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {addresses.map((addressItem) => (
                    <div key={addressItem.address_id} className="rounded-2xl border border-stone-200 bg-[#fafaf9] p-4 transition hover:border-[#d4af37]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-start gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f7edcf] text-[#a77b16]"><MapPin size={15} /></span>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900">{addressItem.address_label}</p>
                            <p className="mt-1 truncate text-xs text-slate-500">{addressItem.recipient_name} · {addressItem.contact_number}</p>
                          </div>
                        </div>
                        {addressItem.is_default && (
                          <span className="shrink-0 rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-white">Default</span>
                        )}
                      </div>
                      <p className="mt-4 text-[13px] leading-5 text-slate-700">
                        {addressItem.house_no ? `${addressItem.house_no}, ` : ''}
                        {addressItem.street}, {addressItem.barangay}, {addressItem.city}, {addressItem.province}
                        {addressItem.zip_code ? `, ${addressItem.zip_code}` : ''}
                      </p>
                      {addressItem.landmark && <p className="mt-2 text-xs text-slate-500">Landmark: {addressItem.landmark}</p>}
                      {addressItem.delivery_instructions && <p className="mt-2 text-xs text-slate-500">Note: {addressItem.delivery_instructions}</p>}
                      <button
                        type="button"
                        onClick={() => handleEdit(addressItem)}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-900 hover:text-slate-900"
                      >
                        <Pencil size={14} />
                        Edit Address
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
    </PageShell>
  );
}
