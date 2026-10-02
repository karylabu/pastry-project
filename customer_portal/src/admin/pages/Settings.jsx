import React, { useEffect, useState } from "react";
import { Bell, Building2, Check, Clock3, KeyRound, LogOut, Save, UserCircle2 } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

const STORAGE_KEY = "admin_settings";
const defaultPreferences = {
  shopName: "Pastry Project",
  shopEmail: "",
  shopPhone: "",
  shopAddress: "",
  openingHours: "08:00 - 20:00",
  deliveryFee: "0",
  minimumOrder: "0",
  preparationTime: "30",
  lowStockThreshold: "5",
  orderAlerts: true,
  lowStockAlerts: true,
  messageAlerts: true,
  promotionAlerts: true,
};

function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
}

function Section({ icon: Icon, eyebrow, title, children, className = "" }) {
  return (
    <section className={`rounded-lg border border-[#e9e1d9] border-t-[3px] border-t-[#c9a94f] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)] transition duration-200 hover:-translate-y-0.5 hover:border-[#c9a94f] hover:ring-1 hover:ring-[#d4af37]/20 hover:shadow-[0_10px_24px_rgba(91,64,39,0.08)] ${className}`}>
      <div className="flex items-center gap-3 border-b border-[#f0e9e2] px-4 py-3.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#fff4cd] text-[#9b7810]"><Icon size={16} /></span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#92701e]">{eyebrow}</p>
          <h2 className="mt-0.5 text-[13px] font-semibold text-[#33251e]">{title}</h2>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-[#65574d]">{label}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="mt-1.5 h-10 w-full rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15" />
    </label>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2.5">
      <span><span className="block text-[12px] font-medium text-[#33251e]">{label}</span><span className="mt-0.5 block text-[10px] leading-4 text-[#8f8076]">{description}</span></span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? "bg-[#81906c]" : "bg-[#c8c0b6]"}`}><span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-[18px]" : "left-0.5"}`} /></span>
    </label>
  );
}

export default function Settings() {
  const [user, setUser] = useState(() => getUser());
  const [preferences, setPreferences] = useState(() => {
    try { return { ...defaultPreferences, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")} } catch { return defaultPreferences; }
  });
  const [profile, setProfile] = useState({ full_name: "", email: "", phone: "" });
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  useEffect(() => {
    if (user) setProfile({ full_name: user.name || "", email: user.email || "", phone: user.phone || "" });
  }, [user]);

  const updatePreference = (key, value) => setPreferences((current) => ({ ...current, [key]: value }));
  const savePreferences = () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences)); setNotice("Settings saved successfully."); setError(""); };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!user?.id) return;
    setSavingProfile(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/profile`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify({ ...profile, name: profile.full_name }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to update profile.");
      const updated = { ...user, name: profile.full_name, email: profile.email, phone: profile.phone };
      localStorage.setItem("user", JSON.stringify(updated)); setUser(updated); setNotice("Admin profile updated successfully.");
    } catch (saveError) { setError(saveError.message); }
    finally { setSavingProfile(false); }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (!user?.id) return;
    if (password.new_password !== password.confirm_password) { setError("New password and confirmation do not match."); return; }
    setSavingPassword(true); setError(""); setNotice("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/password/change`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json", ...getAuthHeaders() }, body: JSON.stringify(password) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to change password.");
      setPassword({ current_password: "", new_password: "", confirm_password: "" }); setNotice("Password changed successfully.");
    } catch (saveError) { setError(saveError.message); }
    finally { setSavingPassword(false); }
  };

  const confirmLogout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("auth_token");
    window.location.href = "/admin/login";
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div className="pt-[72px] lg:pl-[260px]">
        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-5 flex flex-col gap-4 border-b border-[#e8dfd4] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">System</p>
              <h1 className="text-[26px] font-bold leading-tight text-[#33251e] sm:text-[30px]">Admin Settings</h1>
              <p className="mt-1.5 text-[13px] text-[#74675f]">Manage your account and operating preferences.</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 self-start sm:items-end sm:self-auto">
              <div className="mr-1 flex min-w-0 items-center gap-2 text-[11px] text-[#74675f]">
                <UserCircle2 size={16} className="shrink-0 text-[#9b7810]" />
                <span className="max-w-[180px] truncate font-medium text-[#33251e]">{user?.name || "Admin account"}</span>
                <span className="text-[#8f8076]">· {user?.role || "admin"}</span>
              </div>
              <button type="button" onClick={() => setLogoutConfirmOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#efd8d4] px-3 text-[11px] font-semibold text-[#8d5357] transition hover:bg-[#fff0f0]"><LogOut size={14} /> Log out</button>
              <button type="button" onClick={savePreferences} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#33251e] px-4 text-[12px] font-semibold text-white transition hover:bg-[#5b4540]"><Save size={15} /> Save settings</button>
            </div>
          </div>

          {(notice || error) && <div role="status" className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-[12px] ${error ? "border-[#efd8d4] bg-[#fff0f0] text-[#8d5357]" : "border-[#d8e7d5] bg-[#edf5eb] text-[#4f7654]"}`}><Check size={15} />{error || notice}</div>}

          <div className="grid items-stretch gap-4 xl:grid-cols-2">
            <Section icon={UserCircle2} eyebrow="Account" title="Admin profile" className="h-full">
              <form onSubmit={saveProfile} className="space-y-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Full name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                  <Field label="Email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
                <Field label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                <button disabled={savingProfile} className="rounded-md bg-[#33251e] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#5b4540] disabled:opacity-60">{savingProfile ? "Saving..." : "Save profile"}</button>
              </form>
            </Section>

            <Section icon={KeyRound} eyebrow="Security" title="Change password" className="h-full">
              <form onSubmit={savePassword} className="space-y-3.5">
                <Field label="Current password" type="password" value={password.current_password} onChange={(e) => setPassword({ ...password, current_password: e.target.value })} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="New password" type="password" value={password.new_password} onChange={(e) => setPassword({ ...password, new_password: e.target.value })} />
                  <Field label="Confirm password" type="password" value={password.confirm_password} onChange={(e) => setPassword({ ...password, confirm_password: e.target.value })} />
                </div>
                <button disabled={savingPassword} className="rounded-md bg-[#33251e] px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-[#5b4540] disabled:opacity-60">{savingPassword ? "Updating..." : "Update password"}</button>
              </form>
            </Section>

            <Section icon={Building2} eyebrow="Business" title="Business information" className="h-full">
              <div className="space-y-3.5">
                <Field label="Shop name" value={preferences.shopName} onChange={(e) => updatePreference("shopName", e.target.value)} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Business email" type="email" value={preferences.shopEmail} onChange={(e) => updatePreference("shopEmail", e.target.value)} />
                  <Field label="Phone number" value={preferences.shopPhone} onChange={(e) => updatePreference("shopPhone", e.target.value)} />
                </div>
                <Field label="Address" value={preferences.shopAddress} onChange={(e) => updatePreference("shopAddress", e.target.value)} />
                <Field label="Opening hours" value={preferences.openingHours} onChange={(e) => updatePreference("openingHours", e.target.value)} />
              </div>
            </Section>

            <Section icon={Bell} eyebrow="Notifications" title="Admin alerts" className="h-full">
              <div className="divide-y divide-[#f0e9e2]">
                <Toggle label="New order alerts" description="Know when a customer places an order." checked={preferences.orderAlerts} onChange={(e) => updatePreference("orderAlerts", e.target.checked)} />
                <Toggle label="Low-stock alerts" description="Receive inventory warnings early." checked={preferences.lowStockAlerts} onChange={(e) => updatePreference("lowStockAlerts", e.target.checked)} />
                <Toggle label="Customer messages" description="Stay informed about new conversations." checked={preferences.messageAlerts} onChange={(e) => updatePreference("messageAlerts", e.target.checked)} />
                <Toggle label="Promotion updates" description="Track campaign activity and delivery results." checked={preferences.promotionAlerts} onChange={(e) => updatePreference("promotionAlerts", e.target.checked)} />
              </div>
            </Section>

            <Section icon={Clock3} eyebrow="Operations" title="Order and inventory rules" className="h-full xl:col-span-2">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <Field label="Delivery fee" type="number" value={preferences.deliveryFee} onChange={(e) => updatePreference("deliveryFee", e.target.value)} />
                <Field label="Minimum order" type="number" value={preferences.minimumOrder} onChange={(e) => updatePreference("minimumOrder", e.target.value)} />
                <Field label="Prep. minutes" type="number" value={preferences.preparationTime} onChange={(e) => updatePreference("preparationTime", e.target.value)} />
                <Field label="Low-stock threshold" type="number" value={preferences.lowStockThreshold} onChange={(e) => updatePreference("lowStockThreshold", e.target.value)} />
              </div>
            </Section>
          </div>
        </main>
      </div>
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 px-4" onClick={() => setLogoutConfirmOpen(false)}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title" aria-describedby="logout-confirm-description" className="w-full max-w-md rounded-lg border border-[#e9e1d9] bg-white p-5 shadow-xl" onClick={(event) => event.stopPropagation()}>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#92701e]">Confirm logout</p>
            <h2 id="logout-confirm-title" className="mt-2 text-[18px] font-semibold text-[#33251e]">Are you sure you want to log out?</h2>
            <p id="logout-confirm-description" className="mt-2 text-[13px] leading-5 text-[#74675f]">You will need to sign in again to access the admin panel.</p>
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setLogoutConfirmOpen(false)} className="rounded-md border border-[#e8dfd4] px-4 py-2 text-[12px] font-medium text-[#65574d] transition hover:bg-[#fbf7f2]">Cancel</button>
              <button type="button" onClick={confirmLogout} className="rounded-md bg-[#8d5357] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#754248]">Log out</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
