import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import PageShell from '../components/PageShell';
import {
  Lock,
  ShieldCheck,
  LogOut,
  Trash2,
  Download,
  Eye,
  EyeOff,
  UserCircle2,
  ChevronRight,
  ChevronDown,
  ArrowLeft,
  Search,
  Settings as SettingsIcon,
  KeyRound,
  Monitor,
  Camera,
  MapPin,
} from 'lucide-react';
import { getAuthHeaders, safeParseJson } from '../../services/api';
import { LARAVEL_BASE } from '../../services/config';

const BASE = LARAVEL_BASE;
const PSGC_BASE = 'https://psgc.gitlab.io/api';

async function loadLocationOptions(path) {
  const response = await fetch(`${PSGC_BASE}/${path}`);
  if (!response.ok) throw new Error('Unable to load location options.');
  const locations = await response.json();
  if (!Array.isArray(locations)) throw new Error('Invalid location options.');
  return locations.sort((left, right) => left.name.localeCompare(right.name));
}

function normalizeLocationName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/^(city|municipality) of /, '')
    .replace(/ (city|municipality)$/, '')
    .trim();
}

function findLocation(options, name) {
  const normalizedName = normalizeLocationName(name);
  return options.find((option) => normalizeLocationName(option.name) === normalizedName);
}

export default function AccountSettings() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');
  const [toast, setToast] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeSection, setActiveSection] = useState(() => (
    searchParams.get('section') === 'profile' ? 'profile' : 'overview'
  ));
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordFormOpen, setPasswordFormOpen] = useState(true);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  const [profilePhotoPreview, setProfilePhotoPreview] = useState('');
  const profilePhotoInputRef = useRef(null);
  const [defaultAddressId, setDefaultAddressId] = useState(null);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [addressLoadError, setAddressLoadError] = useState('');
  const [locationSearchError, setLocationSearchError] = useState('');
  const [provinceOptions, setProvinceOptions] = useState([]);
  const [cityOptions, setCityOptions] = useState([]);
  const [barangayOptions, setBarangayOptions] = useState([]);
  const [cityOptionsLoading, setCityOptionsLoading] = useState(false);
  const [barangayOptionsLoading, setBarangayOptionsLoading] = useState(false);
  const locationRequestRef = useRef({ cities: 0, barangays: 0 });
  const [addressForm, setAddressForm] = useState({
    house_no: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    zip_code: '',
  });

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    username: '',
    email: '',
    phone: '',
    profile_picture: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const [deletePassword, setDeletePassword] = useState('');

  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || 'null');
    if (!storedUser?.id) {
      setLoading(false);
      setMessage('Please sign in to manage your account.');
      setMessageType('error');
      setToast({ text: 'Please sign in to manage your account.', type: 'error' });
      return;
    }

    setUser(storedUser);
    setProfileForm({
      full_name: storedUser.name || '',
      username: storedUser.username || '',
      email: storedUser.email || '',
      phone: storedUser.phone || '',
      profile_picture: storedUser.profile_picture || storedUser.profile_image || storedUser.avatar || '',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (activeSection !== 'profile' || location.hash !== '#address') return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById('address')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, location.hash]);

  useEffect(() => {
    if (activeSection === 'profile' && location.hash === '#address') return undefined;
    const frame = window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, location.hash]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;

    const loadDefaultAddress = async () => {
      setAddressLoading(true);
      setAddressLoadError('');
      try {
        const response = await fetch(`${BASE}/api/addresses`, {
          credentials: 'include',
          headers: getAuthHeaders(),
        });
        const data = await safeParseJson(response);
        if (!response.ok || data?.status !== 'success') {
          throw new Error(data?.message || 'Unable to load your saved addresses.');
        }

        const savedAddresses = Array.isArray(data.addresses) ? data.addresses : [];
        const defaultAddress = savedAddresses.find((address) => address.is_default);
        if (cancelled) return;

        setDefaultAddressId(defaultAddress?.address_id || null);
        setAddressForm({
          house_no: defaultAddress?.house_no || '',
          street: defaultAddress?.street || '',
          barangay: defaultAddress?.barangay || '',
          city: defaultAddress?.city || '',
          province: defaultAddress?.province || '',
          zip_code: defaultAddress?.zip_code || '',
        });

        try {
          const provinces = await loadLocationOptions('provinces/');
          if (cancelled) return;
          setProvinceOptions(provinces);
          const selectedProvince = findLocation(provinces, defaultAddress?.province);
          if (selectedProvince) {
            const cities = await loadLocationOptions(`provinces/${selectedProvince.code}/cities-municipalities/`);
            if (cancelled) return;
            setCityOptions(cities);
            const selectedCity = findLocation(cities, defaultAddress?.city);
            if (selectedCity) {
              const barangays = await loadLocationOptions(`cities-municipalities/${selectedCity.code}/barangays/`);
              if (cancelled) return;
              setBarangayOptions(barangays);
              const selectedBarangay = findLocation(barangays, defaultAddress?.barangay);
              if (selectedBarangay) {
                setAddressForm((current) => ({ ...current, barangay: selectedBarangay.name }));
              }
              setAddressForm((current) => ({ ...current, city: selectedCity.name }));
            }
            setAddressForm((current) => ({ ...current, province: selectedProvince.name }));
          }
        } catch {
          if (!cancelled) setLocationSearchError('Location search is temporarily unavailable. Please try again.');
        }
      } catch {
        if (!cancelled) setAddressLoadError('Unable to load your saved addresses. You can still add a default address.');
      } finally {
        if (!cancelled) setAddressLoading(false);
      }
    };

    loadDefaultAddress();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (activeSection !== 'security' || !user?.id) return;

    fetch(`${BASE}/api/sessions`, { credentials: 'include', headers: getAuthHeaders() })
      .then(safeParseJson)
      .then((data) => {
        if (data?.success && Array.isArray(data.sessions)) setSessions(data.sessions);
      })
      .catch(() => setSessions([]));
  }, [activeSection, user]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!profilePhotoFile) {
      setProfilePhotoPreview('');
      return undefined;
    }

    const previewUrl = URL.createObjectURL(profilePhotoFile);
    setProfilePhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [profilePhotoFile]);

  const initials = useMemo(() => {
    const name = user?.name || user?.full_name || 'User';
    return name.split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }, [user]);

  const showAlert = (text, type = 'success') => {
    setMessage(text);
    setMessageType(type);
    setToast({ text, type });
  };

  const sectionOptions = [
    {
      key: 'profile',
      title: 'Edit Profile',
      description: 'Update your name, email, phone, and profile photo.',
      icon: <UserCircle2 size={20} />,
      accent: 'bg-[#fff4cf] text-[#8b6a24]',
    },
    {
      key: 'security',
      title: 'Security',
      description: 'Change your password and manage sign-in protection.',
      icon: <Lock size={20} />,
      accent: 'bg-[#f6eadf] text-[#9a5b32]',
    },
    {
      key: 'privacy',
      title: 'Privacy and Account',
      description: 'Download your data, log out of devices, or delete your account.',
      icon: <ShieldCheck size={20} />,
      accent: 'bg-[#fff1d8] text-[#a06a2c]',
    },
  ];

  const filteredSections = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sectionOptions;
    return sectionOptions.filter(
      (item) => item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    setSaving(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('name', profileForm.full_name);
      formData.append('username', profileForm.username);
      formData.append('email', profileForm.email);
      formData.append('phone', profileForm.phone);
      if (profilePhotoFile) formData.append('profile_picture', profilePhotoFile);

      const res = await fetch(`${BASE}/api/profile`, {
        method: 'POST',
        credentials: 'include',
        headers: getAuthHeaders(),
        body: formData,
      });
      const data = await safeParseJson(res);
      if (res.ok && data.success) {
        const savedPhoto = data.user?.profile_image || data.user?.profile_picture || profileForm.profile_picture;
        const updatedUser = {
          ...user,
          ...profileForm,
          name: profileForm.full_name,
          email: profileForm.email,
          phone: profileForm.phone,
          ...(profilePhotoFile ? {
            profile_picture: savedPhoto,
            profile_image: savedPhoto,
            avatar: savedPhoto,
          } : {}),
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        setProfileForm((current) => ({ ...current, profile_picture: savedPhoto }));
        setProfilePhotoFile(null);
        window.dispatchEvent(new Event('customer:user-updated'));
        showAlert('Profile updated successfully.', 'success');
      } else {
        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(' ')
          : '';
        showAlert(data.message || validationMessage || 'Unable to update profile.', 'error');
      }
    } catch {
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDefaultAddressSave = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    const province = findLocation(provinceOptions, addressForm.province);
    const city = findLocation(cityOptions, addressForm.city);
    const barangay = findLocation(barangayOptions, addressForm.barangay);
    if (!province || !city || !barangay) {
      showAlert('Select a Province, City, and Barangay from the search suggestions.', 'error');
      return;
    }

    setAddressSaving(true);
    try {
      const response = await fetch(`${BASE}/api/addresses`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({
          address_label: 'Home',
          recipient_name: user.name || user.full_name || '',
          contact_number: user.phone || user.phone_number || '',
          house_no: addressForm.house_no,
          street: addressForm.street,
          barangay: barangay.name,
          city: city.name,
          province: province.name,
          zip_code: addressForm.zip_code,
          address_id: defaultAddressId || undefined,
          is_default: true,
        }),
      });
      const data = await safeParseJson(response);
      if (!response.ok || data?.status !== 'success') {
        throw new Error(data?.message || 'Unable to save your default address.');
      }

      const savedAddresses = Array.isArray(data.addresses) ? data.addresses : [];
      const savedDefault = savedAddresses.find((address) => address.is_default);
      setDefaultAddressId(savedDefault?.address_id || data.address_id || null);
      window.dispatchEvent(new Event('customer:address-updated'));
      window.dispatchEvent(new Event('customer:user-updated'));
      showAlert('Address saved successfully.', 'success');
    } catch (error) {
      showAlert(error.message || 'Unable to save your default address.', 'error');
    } finally {
      setAddressSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!user?.id) return;

    // Validate passwords match
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showAlert('New password and confirm password do not match.', 'error');
      return;
    }

    // Validate password is not empty
    if (!passwordForm.current_password.trim()) {
      showAlert('Please enter your current password.', 'error');
      return;
    }

    if (!passwordForm.new_password.trim()) {
      showAlert('Please enter a new password.', 'error');
      return;
    }

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(`${BASE}/api/password/change`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ user_id: user.id, ...passwordForm }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
        showAlert('Password updated successfully.', 'success');
      } else {
        showAlert(data.message || 'Unable to update password.', 'error');
      }
    } catch {
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user?.id) return;

    setSaving(true);
    setMessage('');

    try {
      const res = await fetch(`${BASE}/api/account/delete`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify({ password: deletePassword }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        localStorage.removeItem('user');
        showAlert('Account deleted successfully.', 'success');
        window.location.href = '/customer/login';
      } else {
        showAlert(data.message || 'Unable to delete account.', 'error');
      }
    } catch {
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const renderField = (label, value, onChange, type = 'text', placeholder = '', required = false) => (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.16em] text-gray-600 font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#f1cf72]/30 sm:px-4 sm:py-3.5 sm:text-base"
      />
    </label>
  );

  const handleDownloadData = () => {
    showAlert('Your data download request has been received. We will contact you soon.', 'success');
  };

  const handleLogoutAllDevices = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogoutAllDevices = () => {
    localStorage.removeItem('user');
    setShowLogoutConfirm(false);
    showAlert('You have been logged out successfully.', 'success');
    window.location.href = '/customer/login';
  };

  const renderProfileSection = () => (
    <section className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-yellow-50 text-xl font-black text-yellow-600 ring-2 ring-[#e7c878] sm:h-20 sm:w-20">
          {(profilePhotoPreview || profileForm.profile_picture) ? (
            <img src={profilePhotoPreview || profileForm.profile_picture} alt="Profile preview" className="h-full w-full object-cover" />
          ) : initials}
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-gray-900 sm:text-xl">Edit Profile</h2>
          <p className="text-sm text-gray-600">Keep your personal details and photo up to date.</p>
          <input
            ref={profilePhotoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0] || null;
              event.target.value = '';
              if (!file) return;
              if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
                showAlert('Choose a JPG, PNG, or WEBP photo no larger than 5 MB.', 'error');
                return;
              }
              setProfilePhotoFile(file);
              setMessage('');
            }}
          />
          <button
            type="button"
            onClick={() => profilePhotoInputRef.current?.click()}
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#8b6a24] transition hover:text-[#5f4819]"
          >
            <Camera size={14} />
            Choose photo
          </button>
        </div>
      </div>

      <form onSubmit={handleProfileSave} className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
        <div className="grid gap-3 md:grid-cols-2 sm:gap-5">
          {renderField('Full Name', profileForm.full_name, (e) => setProfileForm({ ...profileForm, full_name: e.target.value }), 'text', 'Enter full name')}
          {renderField('Username', profileForm.username, (e) => setProfileForm({ ...profileForm, username: e.target.value }), 'text', 'Enter username')}
        </div>
        <div className="grid gap-3 md:grid-cols-2 sm:gap-5">
          {renderField('Email Address', profileForm.email, (e) => setProfileForm({ ...profileForm, email: e.target.value }), 'email', 'Enter email address')}
          {renderField('Phone Number', profileForm.phone, (e) => setProfileForm({ ...profileForm, phone: e.target.value }), 'tel', 'Enter phone number')}
        </div>
        <button type="submit" disabled={saving} className="rounded-full bg-[#e7b866] px-5 py-3 text-sm font-bold text-[#4a2b20] transition hover:bg-[#f1cf72] disabled:opacity-50 sm:px-6 sm:py-3.5 sm:text-base">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>

      <div id="address" className="scroll-mt-6 border-t border-gray-100 pt-5 sm:pt-6">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
          <MapPin size={18} className="text-[#8b6a24]" /> Address
        </h3>
        {addressLoading && <p className="mb-3 text-sm text-gray-500">Loading saved address…</p>}
        {addressLoadError && <p role="alert" className="mb-3 text-sm text-amber-700">{addressLoadError}</p>}
        {locationSearchError && <p role="alert" className="mb-3 text-sm text-amber-700">{locationSearchError}</p>}
        <form onSubmit={handleDefaultAddressSave} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 sm:gap-5">
            <SearchableLocationField
              label="Province"
              value={addressForm.province}
              options={provinceOptions}
              loading={addressLoading || (provinceOptions.length === 0 && !locationSearchError)}
              placeholder="Search province"
              required
              onChange={async (value) => {
                setAddressForm((current) => ({ ...current, province: value, city: '', barangay: '' }));
                setCityOptions([]);
                setBarangayOptions([]);
                setCityOptionsLoading(false);
                setBarangayOptionsLoading(false);
                locationRequestRef.current.barangays += 1;
                const selectedProvince = findLocation(provinceOptions, value);
                const requestId = ++locationRequestRef.current.cities;
                if (!selectedProvince) return;

                setLocationSearchError('');
                setCityOptionsLoading(true);
                try {
                  const options = await loadLocationOptions(`provinces/${selectedProvince.code}/cities-municipalities/`);
                  if (requestId === locationRequestRef.current.cities) setCityOptions(options);
                } catch {
                  if (requestId === locationRequestRef.current.cities) {
                    setLocationSearchError('Could not load City options. Please try again.');
                  }
                } finally {
                  if (requestId === locationRequestRef.current.cities) setCityOptionsLoading(false);
                }
              }}
            />
            <SearchableLocationField
              label="City"
              value={addressForm.city}
              options={cityOptions}
              loading={cityOptionsLoading}
              placeholder="Search city"
              required
              disabled={!addressForm.province || cityOptionsLoading}
              onChange={async (value) => {
                setAddressForm((current) => ({ ...current, city: value, barangay: '' }));
                setBarangayOptions([]);
                setBarangayOptionsLoading(false);
                const selectedCity = findLocation(cityOptions, value);
                const requestId = ++locationRequestRef.current.barangays;
                if (!selectedCity) return;

                setLocationSearchError('');
                setBarangayOptionsLoading(true);
                try {
                  const options = await loadLocationOptions(`cities-municipalities/${selectedCity.code}/barangays/`);
                  if (requestId === locationRequestRef.current.barangays) setBarangayOptions(options);
                } catch {
                  if (requestId === locationRequestRef.current.barangays) {
                    setLocationSearchError('Could not load Barangay options. Please try again.');
                  }
                } finally {
                  if (requestId === locationRequestRef.current.barangays) setBarangayOptionsLoading(false);
                }
              }}
            />
            <SearchableLocationField
              label="Barangay"
              value={addressForm.barangay}
              options={barangayOptions}
              loading={barangayOptionsLoading}
              placeholder="Search barangay"
              required
              disabled={!addressForm.city || barangayOptionsLoading}
              onChange={(value) => {
                setAddressForm((current) => ({ ...current, barangay: value }));
              }}
            />
            {renderField('House Number', addressForm.house_no, (e) => setAddressForm({ ...addressForm, house_no: e.target.value }), 'text', 'House number', true)}
            {renderField('Street', addressForm.street, (e) => setAddressForm({ ...addressForm, street: e.target.value }), 'text', 'Street name', true)}
            {renderField('Postal Code', addressForm.zip_code, (e) => setAddressForm({ ...addressForm, zip_code: e.target.value }), 'text', 'Postal code', true)}
          </div>
          <button
            type="submit"
            disabled={addressSaving || addressLoading}
            className="rounded-full bg-[#e7b866] px-5 py-3 text-sm font-bold text-[#4a2b20] transition hover:bg-[#f1cf72] disabled:opacity-50 sm:px-6 sm:py-3.5 sm:text-base"
          >
            {addressSaving ? 'Saving…' : defaultAddressId ? 'Update Address' : 'Save Address'}
          </button>
        </form>
      </div>
    </section>
  );

  const renderSecuritySection = () => (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Security</h2>
        <p className="mt-1 text-sm text-gray-500">Update your password and review active sessions.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* Login & recovery */}
        <div>
        <h3 className="text-lg font-bold text-gray-900">Login &amp; recovery</h3>

        <div className="mt-3 divide-y divide-[#ead8c5] border-y border-[#ead8c5]">
          {/* Change password row */}
          <button
            type="button"
            onClick={() => setPasswordFormOpen((open) => !open)}
            className="flex w-full items-center justify-between px-3 py-3 text-left sm:px-5 sm:py-4"
          >
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 p-2 text-gray-600"><KeyRound size={16} /></span>
              <span className="text-[15px] font-semibold text-gray-900">Change password</span>
            </span>
            <ChevronDown size={18} className={`text-gray-400 transition-transform ${passwordFormOpen ? 'rotate-180' : ''}`} />
          </button>

          {passwordFormOpen && (
            <div className="px-5 pb-5">
              <form onSubmit={handlePasswordChange} className="space-y-3 pt-1 sm:space-y-4">
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-gray-600 font-bold">Current Password</span>
                  <div className="mt-2 flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 sm:px-4 sm:py-3.5">
                    <input type={showPassword ? 'text' : 'password'} value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} className="w-full bg-transparent text-sm text-gray-900 outline-none sm:text-base" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2 text-gray-400">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-gray-600 font-bold">New Password</span>
                  <div className="mt-2 flex items-center rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 sm:px-4 sm:py-3.5">
                    <input type={showNewPassword ? 'text' : 'password'} value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} className="w-full bg-transparent text-sm text-gray-900 outline-none sm:text-base" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="ml-2 text-gray-400">{showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-xs uppercase tracking-[0.16em] text-gray-600 font-bold">Confirm New Password</span>
                  <div className={`mt-2 flex items-center rounded-xl border px-3 py-3 sm:px-4 ${
                    passwordForm.new_password && passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <input type={showConfirmPassword ? 'text' : 'password'} value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} className="w-full bg-transparent text-sm text-gray-900 outline-none sm:text-base" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="ml-2 text-gray-400">{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {passwordForm.new_password && passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                    <p className="mt-2 text-xs text-red-600 font-medium">Passwords do not match</p>
                  )}
                </label>

                <button type="submit" disabled={saving} className="rounded-full bg-[#e7b866] px-5 py-3 text-sm font-bold text-[#4a2b20] transition hover:bg-[#f1cf72] disabled:opacity-50 sm:px-6 sm:py-3.5 sm:text-base">
                  {saving ? 'Updating...' : 'Save Password'}
                </button>
              </form>
            </div>
          )}

          {/* Two-factor authentication row (informational) */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 p-2 text-gray-600"><ShieldCheck size={16} /></span>
              <span>
                <span className="block text-[15px] font-semibold text-gray-900">Two-factor authentication</span>
                <span className="block text-xs text-gray-500">Add an extra layer of protection to your account.</span>
              </span>
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">Coming soon</span>
          </div>
        </div>
        </div>

        {/* Security checks */}
        <div>
        <h3 className="text-lg font-bold text-gray-900">Security checks</h3>

        <div className="mt-3 divide-y divide-[#ead8c5] border-y border-[#ead8c5]">
          <button
            type="button"
            onClick={() => setSessionsOpen((open) => !open)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <span className="shrink-0 rounded-full bg-[#fff1d8] p-1.5 text-[#a06a2c] sm:p-2"><Monitor size={15} /></span>
              <span>
              <span className="block text-sm font-semibold text-gray-900 sm:text-[15px]">Where you&apos;re logged in</span>
                <span className="block text-xs text-gray-500">View the devices using your account.</span>
              </span>
            </span>
            <ChevronDown size={18} className={`text-gray-400 transition-transform ${sessionsOpen ? 'rotate-180' : ''}`} />
          </button>

          {sessionsOpen && (sessions.length === 0 ? (
            <div className="px-3 py-3 text-xs text-gray-500 sm:px-5 sm:py-4 sm:text-sm">No active device sessions found.</div>
          ) : sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between gap-2 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
              <span className="flex min-w-0 items-center gap-2 sm:gap-3">
                <span className="shrink-0 rounded-full bg-[#fff1d8] p-1.5 text-[#a06a2c] sm:p-2"><Monitor size={15} /></span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-gray-900 sm:text-[15px]">{session.device_name}</span>
                  <span className="block truncate text-[11px] text-gray-500 sm:text-xs">{session.ip_address} · Signed in {session.created_at}</span>
                </span>
              </span>
              <span className={`shrink-0 text-[9px] font-bold uppercase tracking-[0.08em] sm:text-[10px] sm:tracking-[0.12em] ${session.current ? 'text-[#a06a2c]' : 'text-gray-400'}`}>
                {session.current ? 'This device' : 'Active'}
              </span>
            </div>
          )))}
          <button
            type="button"
            onClick={handleLogoutAllDevices}
            className="flex w-full items-center justify-between px-3 py-3 text-left sm:px-5 sm:py-4"
          >
            <span className="flex items-center gap-2 sm:gap-3">
              <span className="rounded-full bg-gray-100 p-1.5 text-gray-600 sm:p-2"><LogOut size={15} /></span>
              <span className="text-sm font-semibold text-gray-900 sm:text-[15px]">Logout from all devices</span>
            </span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
        </div>
      </div>
    </section>
  );

  const renderPrivacySection = () => (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-[#fff1d8] p-3 text-[#a06a2c] sm:p-4"><UserCircle2 size={22} /></div>
        <div>
          <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">Privacy &amp; account</h2>
          <p className="mt-1 text-sm text-gray-600">Manage your data and account preferences.</p>
        </div>
      </div>

      <div className="divide-y divide-[#ead8c5] border-y border-[#ead8c5]">
        <button onClick={handleDownloadData} className="flex w-full items-center justify-between px-3 py-4 text-left text-sm font-semibold text-gray-700 transition hover:text-[#a06a2c] sm:px-5 sm:py-5 sm:text-base">
          <span className="flex items-center gap-3"><Download size={19} /> Download My Data</span>
          <ChevronRight size={18} className="text-gray-400" />
        </button>
        <button onClick={() => setShowDeleteConfirm(true)} className="flex w-full items-center justify-between px-3 py-4 text-left text-sm font-semibold text-red-600 transition hover:text-red-700 sm:px-5 sm:py-5 sm:text-base">
          <span className="flex items-center gap-3"><Trash2 size={19} /> Delete Account</span>
          <ChevronRight size={18} className="text-red-400" />
        </button>
        <Link to="/customer/privacy-policy" className="flex w-full items-center justify-between px-3 py-4 text-sm font-semibold text-gray-700 transition hover:text-[#a06a2c] sm:px-5 sm:py-5 sm:text-base">
          <span>Privacy Policy</span>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
        <Link to="/customer/terms" className="flex w-full items-center justify-between px-3 py-4 text-sm font-semibold text-gray-700 transition hover:text-[#a06a2c] sm:px-5 sm:py-5 sm:text-base">
          <span>Terms & Conditions</span>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
        <Link to="/customer/cookie-policy" className="flex w-full items-center justify-between px-3 py-4 text-sm font-semibold text-gray-700 transition hover:text-[#a06a2c] sm:px-5 sm:py-5 sm:text-base">
          <span>Cookie Policy</span>
          <ChevronRight size={18} className="text-gray-400" />
        </Link>
      </div>
    </section>
  );

  return (
    <PageShell background="bg-[#fffaf3]" padding="px-3 py-5 sm:px-5 sm:py-6 md:px-6 md:py-7" innerClassName="mx-auto flex w-full max-w-none gap-5">
        {/* Sidebar */}
        <aside className="hidden w-[280px] shrink-0 md:block">
          <h1 className="text-[28px] font-bold text-[#4a2b20]">Settings &amp; privacy</h1>

          <div className="mt-4 flex items-center gap-2 rounded-full border border-[#ead8c5] bg-white px-4 py-2.5">
            <Search size={16} className="text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search settings"
              className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-500 outline-none"
            />
          </div>

          <button
            onClick={() => {
              setActiveSection('overview');
              setSearchParams({});
              setMessage('');
            }}
            className={`mt-6 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-lg font-bold ${activeSection === 'overview' ? 'text-[#a06a2c]' : 'text-[#4a2b20]'}`}
          >
            <SettingsIcon size={18} /> Your account
          </button>

          <nav className="mt-2 space-y-1">
            {sectionOptions.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveSection(item.key);
                  setMessage('');
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-3.5 text-left text-[15px] font-semibold transition ${
                  activeSection === item.key ? 'bg-[#fff1d8] text-[#4a2b20]' : 'text-gray-600 hover:bg-[#fff7df]'
                }`}
              >
                <span className={`rounded-lg p-2 ${item.accent}`}>{item.icon}</span>
                {item.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-5">
          {message && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${messageType === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              {message}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-600">Loading your account...</div>
          ) : activeSection === 'overview' ? (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_10px_28px_rgba(126,82,35,0.05)] sm:p-6 md:p-8">
                <h2 className="text-xl font-bold text-gray-900 sm:text-[26px]">Find the setting you need</h2>
                <div className="mt-3 flex items-center gap-3 rounded-full border border-[#ead8c5] bg-[#fffaf3] px-3 py-2.5 sm:px-4 sm:py-3">
                  <Search size={18} className="text-gray-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search settings"
                    className="w-full bg-transparent text-sm text-gray-900 placeholder-gray-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-xl font-bold text-gray-900 sm:mb-5 sm:text-2xl">Most visited settings</h3>
                {filteredSections.length === 0 ? (
                  <p className="text-sm text-gray-500">No settings match "{searchQuery}".</p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
                    {filteredSections.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveSection(item.key);
                          setMessage('');
                        }}
                        className="rounded-2xl border border-gray-200 bg-white p-4 text-left transition hover:border-[#e7b866] sm:p-6"
                      >
                        <div className={`inline-flex rounded-full p-2.5 sm:p-3 ${item.accent}`}>{item.icon}</div>
                        <h4 className="mt-3 text-base font-bold text-gray-900 sm:mt-4 sm:text-lg">{item.title}</h4>
                        <p className="mt-1.5 text-sm leading-5 text-gray-600 sm:text-[15px] sm:leading-6">{item.description}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setActiveSection('overview');
                  setSearchParams({});
                  setMessage('');
                }}
                className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-blue-600 hover:text-blue-600 md:hidden"
              >
                <ArrowLeft size={16} /> Back
              </button>

              {activeSection === 'profile' && renderProfileSection()}
              {activeSection === 'security' && renderSecuritySection()}
              {activeSection === 'privacy' && renderPrivacySection()}
            </>
          )}
        </div>

      {toast && (
        <div className={`fixed bottom-4 left-1/2 z-[99999] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-lg ${toast.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`} role="alert">
          {toast.text}
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[420px] rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-gray-900">Delete Account</h3>
            <p className="mt-2 text-sm text-gray-600">This action is permanent. Enter your password to continue.</p>
            <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="Confirm password" className="mt-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 outline-none focus:border-red-600" />
            <div className="mt-5 flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700">Cancel</button>
              <button onClick={handleDeleteAccount} disabled={saving} className="flex-1 rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-[420px] rounded-2xl border border-[#ead8c5] bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-[#4a2b20]">Log out from all devices?</h3>
            <p className="mt-2 text-sm leading-6 text-gray-600">You will be signed out of every device using this account.</p>
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} className="flex-1 rounded-full border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50">Cancel</button>
              <button type="button" onClick={confirmLogoutAllDevices} className="flex-1 rounded-full bg-[#e7b866] px-4 py-3 text-sm font-semibold text-[#4a2b20] transition hover:bg-[#f1cf72]">Log out</button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function SearchableLocationField({
  label,
  value,
  options,
  loading = false,
  placeholder,
  required = false,
  disabled = false,
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);
  const normalizedQuery = hasTyped ? value.trim().toLowerCase() : '';
  const filteredOptions = options
    .filter((option) => !normalizedQuery || option.name.toLowerCase().includes(normalizedQuery))
    .slice(0, 100);

  return (
    <div className="relative block">
      <label className="block">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-gray-600">{label}</span>
        <input
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen && !disabled}
          aria-controls={`${label.toLowerCase()}-location-options`}
          value={value}
          onFocus={() => {
            setHasTyped(false);
            setIsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 120)}
          onChange={(event) => {
            setHasTyped(true);
            onChange(event.target.value);
            setIsOpen(true);
          }}
          placeholder={loading ? `Loading ${label.toLowerCase()} options…` : placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-[#d4af37] focus:ring-2 focus:ring-[#f1cf72]/30 disabled:cursor-wait disabled:opacity-60 sm:px-4 sm:py-3.5 sm:text-base"
        />
      </label>
      {isOpen && !disabled && (
        <div
          id={`${label.toLowerCase()}-location-options`}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {loading ? (
            <p className="px-3 py-2 text-sm text-gray-500">Loading options…</p>
          ) : filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                role="option"
                aria-selected={option.name === value}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.name);
                  setHasTyped(false);
                  setIsOpen(false);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-gray-800 transition hover:bg-[#fff4cf] focus:bg-[#fff4cf] focus:outline-none"
              >
                {option.name}
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-gray-500">
              {options.length ? 'No matching options.' : 'No options available.'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
