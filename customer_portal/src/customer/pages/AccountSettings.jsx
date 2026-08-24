import React, { useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { safeParseJson } from '../../services/api';
import { CUSTOMER_BASE } from '../../services/config';

const BASE = CUSTOMER_BASE;

export default function AccountSettings() {
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
  const [activeSection, setActiveSection] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [passwordFormOpen, setPasswordFormOpen] = useState(true);

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
      profile_picture: storedUser.profile_picture || '',
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
      accent: 'bg-yellow-100 text-yellow-600',
    },
    {
      key: 'security',
      title: 'Security',
      description: 'Change your password and manage sign-in protection.',
      icon: <Lock size={20} />,
      accent: 'bg-purple-100 text-purple-600',
    },
    {
      key: 'privacy',
      title: 'Privacy and Account',
      description: 'Download your data, log out of devices, or delete your account.',
      icon: <ShieldCheck size={20} />,
      accent: 'bg-blue-100 text-blue-600',
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
      const res = await fetch(`${BASE}/api_update_profile.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, ...profileForm }),
      });
      const data = await safeParseJson(res);
      if (data.success) {
        const updatedUser = { ...user, ...profileForm, name: profileForm.full_name, email: profileForm.email, phone: profileForm.phone };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
        showAlert('Profile updated successfully.', 'success');
      } else {
        showAlert(data.message || 'Unable to update profile.', 'error');
      }
    } catch {
      showAlert('Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
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
      const res = await fetch(`${BASE}/api_change_password.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      const res = await fetch(`${BASE}/api_delete_account.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, password: deletePassword }),
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

  const renderField = (label, value, onChange, type = 'text', placeholder = '') => (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none"
      />
    </label>
  );

  const handleDownloadData = () => {
    showAlert('Your data download request has been received. We will contact you soon.', 'success');
  };

  const handleLogoutAllDevices = () => {
    localStorage.removeItem('user');
    showAlert('You have been logged out successfully.', 'success');
    window.location.href = '/customer/login';
  };

  const renderProfileSection = () => (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-yellow-50 text-xl font-black text-yellow-600">
          {profileForm.profile_picture ? <img src={profileForm.profile_picture} alt="Profile" className="h-full w-full rounded-full object-cover" /> : initials}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Edit Profile</h2>
          <p className="text-sm text-gray-600">Keep your personal details up to date.</p>
        </div>
      </div>

      <form onSubmit={handleProfileSave} className="mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {renderField('Full Name', profileForm.full_name, (e) => setProfileForm({ ...profileForm, full_name: e.target.value }), 'text', 'Enter full name')}
          {renderField('Username', profileForm.username, (e) => setProfileForm({ ...profileForm, username: e.target.value }), 'text', 'Enter username')}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {renderField('Email Address', profileForm.email, (e) => setProfileForm({ ...profileForm, email: e.target.value }), 'email', 'Enter email address')}
          {renderField('Phone Number', profileForm.phone, (e) => setProfileForm({ ...profileForm, phone: e.target.value }), 'tel', 'Enter phone number')}
        </div>
        {renderField('Profile Picture (optional)', profileForm.profile_picture, (e) => setProfileForm({ ...profileForm, profile_picture: e.target.value }), 'text', 'Paste image URL here')}
        <button type="submit" disabled={saving} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </section>
  );

  const renderSecuritySection = () => (
    <section className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Password and security</h2>
        <p className="mt-1 text-sm text-gray-500">Manage your password, login preferences and recovery methods.</p>
      </div>

      {/* Login & recovery */}
      <div>
        <h3 className="text-lg font-bold text-gray-900">Login &amp; recovery</h3>
        <p className="mt-1 text-sm text-gray-500">Manage your password and login preferences.</p>

        <div className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          {/* Change password row */}
          <button
            type="button"
            onClick={() => setPasswordFormOpen((open) => !open)}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 p-2 text-gray-600"><KeyRound size={16} /></span>
              <span className="text-[15px] font-semibold text-gray-900">Change password</span>
            </span>
            <ChevronDown size={18} className={`text-gray-400 transition-transform ${passwordFormOpen ? 'rotate-180' : ''}`} />
          </button>

          {passwordFormOpen && (
            <div className="px-5 pb-5">
              <form onSubmit={handlePasswordChange} className="space-y-4 pt-1">
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">Current Password</span>
                  <div className="mt-2 flex items-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <input type={showPassword ? 'text' : 'password'} value={passwordForm.current_password} onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })} className="w-full bg-transparent text-sm text-gray-900 outline-none" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="ml-2 text-gray-400">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">New Password</span>
                  <div className="mt-2 flex items-center rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <input type={showNewPassword ? 'text' : 'password'} value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} className="w-full bg-transparent text-sm text-gray-900 outline-none" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="ml-2 text-gray-400">{showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                </label>
                <label className="block">
                  <span className="text-[11px] uppercase tracking-[0.2em] text-gray-600 font-bold">Confirm New Password</span>
                  <div className={`mt-2 flex items-center rounded-xl border px-4 py-3 ${
                    passwordForm.new_password && passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}>
                    <input type={showConfirmPassword ? 'text' : 'password'} value={passwordForm.confirm_password} onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })} className="w-full bg-transparent text-sm text-gray-900 outline-none" />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="ml-2 text-gray-400">{showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                  </div>
                  {passwordForm.new_password && passwordForm.confirm_password && passwordForm.new_password !== passwordForm.confirm_password && (
                    <p className="mt-2 text-xs text-red-600 font-medium">Passwords do not match</p>
                  )}
                </label>

                <button type="submit" disabled={saving} className="rounded-full bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50">
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
        <p className="mt-1 text-sm text-gray-500">Review where you're logged in and sign out of devices you don't recognize.</p>

        <div className="mt-4 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
          <button
            type="button"
            onClick={handleLogoutAllDevices}
            className="flex w-full items-center justify-between px-5 py-4 text-left"
          >
            <span className="flex items-center gap-3">
              <span className="rounded-full bg-gray-100 p-2 text-gray-600"><LogOut size={16} /></span>
              <span className="text-[15px] font-semibold text-gray-900">Logout from all devices</span>
            </span>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        </div>
      </div>
    </section>
  );

  const renderPrivacySection = () => (
    <section className="rounded-2xl border border-gray-200 bg-white p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-100 p-3 text-blue-600"><UserCircle2 size={20} /></div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Privacy and Account</h3>
          <p className="text-sm text-gray-600">Download your data or remove your account.</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button onClick={handleDownloadData} className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:border-blue-600 hover:text-blue-600">
          <span className="flex items-center gap-2"><Download size={16} /> Download My Data</span>
          <span className="text-xs uppercase tracking-[0.15em] text-gray-500">Optional</span>
        </button>
        <button onClick={handleLogoutAllDevices} className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:border-red-600 hover:text-red-600">
          <span className="flex items-center gap-2"><LogOut size={16} /> Logout from All Devices</span>
          <span className="text-xs uppercase tracking-[0.15em] text-gray-500">Optional</span>
        </button>
        <button onClick={() => setShowDeleteConfirm(true)} className="flex w-full items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm font-semibold text-red-600">
          <span className="flex items-center gap-2"><Trash2 size={16} /> Delete Account</span>
          <span className="text-xs uppercase tracking-[0.15em] text-red-500">Confirm</span>
        </button>
        <a href="/privacy.html" className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:border-blue-600 hover:text-blue-600">
          <span>Privacy Policy</span>
        </a>
        <a href="/terms.html" className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700 hover:border-blue-600 hover:text-blue-600">
          <span>Terms & Conditions</span>
        </a>
      </div>
    </section>
  );

  return (
    <PageShell background="bg-gray-50" innerClassName="mx-auto flex max-w-[1200px] gap-6">
        {/* Sidebar */}
        <aside className="hidden w-[280px] shrink-0 md:block">
          <h1 className="text-2xl font-bold text-gray-900">Settings &amp; privacy</h1>

          <div className="mt-4 flex items-center gap-2 rounded-full bg-gray-100 px-4 py-2.5">
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
              setMessage('');
            }}
            className={`mt-6 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-lg font-bold ${activeSection === 'overview' ? 'text-blue-600' : 'text-gray-900'}`}
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
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-semibold transition ${
                  activeSection === item.key ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className={`rounded-lg p-2 ${item.accent}`}>{item.icon}</span>
                {item.title}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <div className="min-w-0 flex-1 space-y-6">
          {message && (
            <div className={`rounded-xl border px-4 py-3 text-sm ${messageType === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>
              {message}
            </div>
          )}

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-8 text-sm text-gray-600">Loading your account...</div>
          ) : activeSection === 'overview' ? (
            <>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
                <h2 className="text-2xl font-bold text-gray-900">Find the setting you need</h2>
                <div className="mt-4 flex items-center gap-3 rounded-full bg-gray-100 px-5 py-3.5">
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
                <h3 className="mb-4 text-xl font-bold text-gray-900">Most visited settings</h3>
                {filteredSections.length === 0 ? (
                  <p className="text-sm text-gray-500">No settings match "{searchQuery}".</p>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredSections.map((item) => (
                      <button
                        key={item.key}
                        onClick={() => {
                          setActiveSection(item.key);
                          setMessage('');
                        }}
                        className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition hover:border-blue-300"
                      >
                        <div className={`inline-flex rounded-full p-3 ${item.accent}`}>{item.icon}</div>
                        <h4 className="mt-4 text-base font-bold text-gray-900">{item.title}</h4>
                        <p className="mt-1 text-sm text-gray-600">{item.description}</p>
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
    </PageShell>
  );
}
