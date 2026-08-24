import React, { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell';
import { CUSTOMER_BASE } from '../../services/config';
import { safeParseJson } from '../../services/api';

const LABELS = ['Home', 'Work', 'School', 'Other'];

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
    <PageShell innerClassName="space-y-10">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[#d4af37] font-black">Saved Addresses</p>
          <h1 className="text-2xl font-bold mt-3 text-gray-900">Add or Edit Address</h1>
          <p className="mt-1 text-sm text-gray-500 max-w-2xl">Add a new delivery address or update an existing one. Select a label, provide recipient details, and save it to your account.</p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[1fr_420px]">
          <section ref={formSectionRef} className="rounded-[30px] border border-gray-100 bg-gray-50 p-8 space-y-8">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500 font-semibold">Address Label</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {LABELS.map((label) => (
                  <button
                    type="button"
                    key={label}
                    onClick={() => handleChange('address_label', label)}
                    className={`rounded-[18px] border px-4 py-3 text-sm font-semibold transition ${form.address_label === label ? 'border-black bg-black text-white' : 'border-gray-200 bg-white text-gray-700 hover:border-black'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500 font-semibold">Recipient Information</p>
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
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500 font-semibold">Address Details</p>
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
              <p className="text-xs uppercase tracking-[0.35em] text-gray-500 font-semibold">Additional Information</p>
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

            <label className="inline-flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) => handleChange('is_default', e.target.checked)}
                className="h-5 w-5 rounded border-gray-300 text-[#d4af37] focus:ring-[#d4af37]"
              />
              <span className="font-semibold">Set as Default Address</span>
            </label>

            {message && <div className="rounded-3xl border border-green-100 bg-green-50 px-5 py-4 text-sm text-green-700">{message}</div>}
            {error && <div className="rounded-3xl border border-red-100 bg-red-50 px-5 py-4 text-sm text-red-700">{error}</div>}

            <button
              type="submit"
              onClick={handleSubmit}
              disabled={loading}
              className="inline-flex items-center justify-center rounded-full bg-black px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white hover:bg-[#333] transition disabled:opacity-60"
            >
              {loading ? 'Saving…' : form.address_id ? 'Update Address' : 'Save Address'}
            </button>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[30px] border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Saved Addresses</h2>
              {addresses.length === 0 ? (
                <p className="text-sm text-gray-500">No saved addresses yet. Add one using the form.</p>
              ) : (
                <div className="space-y-4">
                  {addresses.map((addressItem) => (
                    <div key={addressItem.address_id} className="rounded-[24px] border border-gray-200 p-4 bg-gray-50">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{addressItem.address_label}</p>
                          <p className="text-xs text-gray-500 mt-1">{addressItem.recipient_name} • {addressItem.contact_number}</p>
                        </div>
                        {addressItem.is_default && (
                          <span className="rounded-full bg-black px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-white">Default</span>
                        )}
                      </div>
                      <p className="mt-3 text-sm text-gray-700 leading-relaxed">
                        {addressItem.house_no ? `${addressItem.house_no}, ` : ''}
                        {addressItem.street}, {addressItem.barangay}, {addressItem.city}, {addressItem.province}
                        {addressItem.zip_code ? `, ${addressItem.zip_code}` : ''}
                      </p>
                      {addressItem.landmark && <p className="mt-2 text-sm text-gray-500">Landmark: {addressItem.landmark}</p>}
                      {addressItem.delivery_instructions && <p className="mt-2 text-sm text-gray-500">Note: {addressItem.delivery_instructions}</p>}
                      <button
                        type="button"
                        onClick={() => handleEdit(addressItem)}
                        className="mt-4 inline-flex items-center rounded-full border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-black hover:text-black transition"
                      >
                        Edit Address
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
