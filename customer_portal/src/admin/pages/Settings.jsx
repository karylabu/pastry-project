import React, { useEffect, useState } from "react";
import { Bell, Building2, Check, Clock3, KeyRound, LogOut, Save, ShieldCheck, UserCircle2 } from "lucide-react";
import { CUSTOMER_BASE } from "../../services/config";

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

function Section({ icon: Icon, eyebrow, title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon size={17} /></span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#b88716]">{eyebrow}</p>
          <h2 className="mt-0.5 text-[15px] font-semibold text-slate-900">{title}</h2>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{label}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100" />
    </label>
  );
}

function Toggle({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-2">
      <span><span className="block text-[13px] font-medium text-slate-900">{label}</span><span className="block text-[11px] text-slate-500">{description}</span></span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-slate-900" : "bg-slate-200"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></span>
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
      const response = await fetch(`${CUSTOMER_BASE}/api_update_profile.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.id, ...profile }) });
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
      const response = await fetch(`${CUSTOMER_BASE}/api_change_password.php`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.id, ...password }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to change password.");
      setPassword({ current_password: "", new_password: "", confirm_password: "" }); setNotice("Password changed successfully.");
    } catch (saveError) { setError(saveError.message); }
    finally { setSavingPassword(false); }
  };

  const logout = () => { localStorage.removeItem("user"); window.location.href = "/admin/login"; };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="pt-[72px] lg:pl-[260px]"><main className="mx-auto max-w-[1400px] px-6 py-6 md:px-10">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.35em] text-[#b88716]">System</p><h1 className="mt-1 text-[26px] font-bold">Admin Settings</h1><p className="mt-1 text-[13px] text-slate-500">Manage your account and the operating rules for Pastry Project.</p></div>
          <button type="button" onClick={savePreferences} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white transition hover:bg-slate-700"><Save size={15} /> Save settings</button>
        </div>
        {(notice || error) && <div className={`mb-4 flex items-center gap-2 rounded-xl border px-4 py-3 text-[13px] ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}><Check size={15} />{error || notice}</div>}
        <div className="grid items-start gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <Section icon={UserCircle2} eyebrow="Account" title="Admin profile">
              <form onSubmit={saveProfile} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name" value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /><Field label="Email" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></div><Field label="Phone" value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /><button disabled={savingProfile} className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-60">{savingProfile ? "Saving..." : "Save profile"}</button></form>
            </Section>
            <Section icon={KeyRound} eyebrow="Security" title="Change password">
              <form onSubmit={savePassword} className="space-y-4"><Field label="Current password" type="password" value={password.current_password} onChange={(e) => setPassword({ ...password, current_password: e.target.value })} /><div className="grid gap-4 sm:grid-cols-2"><Field label="New password" type="password" value={password.new_password} onChange={(e) => setPassword({ ...password, new_password: e.target.value })} /><Field label="Confirm password" type="password" value={password.confirm_password} onChange={(e) => setPassword({ ...password, confirm_password: e.target.value })} /></div><button disabled={savingPassword} className="rounded-xl bg-slate-900 px-4 py-2.5 text-[12px] font-semibold text-white disabled:opacity-60">{savingPassword ? "Updating..." : "Update password"}</button></form>
            </Section>
            <Section icon={ShieldCheck} eyebrow="Access" title="Current session"><div className="flex items-center justify-between gap-4"><div><p className="text-[13px] font-semibold">{user?.name || "Admin account"}</p><p className="mt-1 text-[12px] text-slate-500">{user?.email || "No email available"} · {user?.role || "admin"}</p></div><button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-[12px] font-semibold text-red-700 hover:bg-red-50"><LogOut size={14} /> Log out</button></div></Section>
          </div>
          <div className="space-y-4">
            <Section icon={Building2} eyebrow="Business" title="Business information"><div className="space-y-4"><Field label="Shop name" value={preferences.shopName} onChange={(e) => updatePreference("shopName", e.target.value)} /><div className="grid gap-4 sm:grid-cols-2"><Field label="Business email" type="email" value={preferences.shopEmail} onChange={(e) => updatePreference("shopEmail", e.target.value)} /><Field label="Phone number" value={preferences.shopPhone} onChange={(e) => updatePreference("shopPhone", e.target.value)} /></div><Field label="Address" value={preferences.shopAddress} onChange={(e) => updatePreference("shopAddress", e.target.value)} /><Field label="Opening hours" value={preferences.openingHours} onChange={(e) => updatePreference("openingHours", e.target.value)} /></div></Section>
            <Section icon={Clock3} eyebrow="Operations" title="Order and inventory rules"><div className="grid gap-4 sm:grid-cols-3"><Field label="Delivery fee" type="number" value={preferences.deliveryFee} onChange={(e) => updatePreference("deliveryFee", e.target.value)} /><Field label="Minimum order" type="number" value={preferences.minimumOrder} onChange={(e) => updatePreference("minimumOrder", e.target.value)} /><Field label="Prep. minutes" type="number" value={preferences.preparationTime} onChange={(e) => updatePreference("preparationTime", e.target.value)} /></div><div className="mt-4 max-w-[220px]"><Field label="Low-stock threshold" type="number" value={preferences.lowStockThreshold} onChange={(e) => updatePreference("lowStockThreshold", e.target.value)} /></div></Section>
            <Section icon={Bell} eyebrow="Notifications" title="Admin alerts"><div className="divide-y divide-slate-100"><Toggle label="New order alerts" description="Know when a customer places an order." checked={preferences.orderAlerts} onChange={(e) => updatePreference("orderAlerts", e.target.checked)} /><Toggle label="Low-stock alerts" description="Receive inventory warnings early." checked={preferences.lowStockAlerts} onChange={(e) => updatePreference("lowStockAlerts", e.target.checked)} /><Toggle label="Customer messages" description="Stay informed about new conversations." checked={preferences.messageAlerts} onChange={(e) => updatePreference("messageAlerts", e.target.checked)} /><Toggle label="Promotion updates" description="Track campaign activity and delivery results." checked={preferences.promotionAlerts} onChange={(e) => updatePreference("promotionAlerts", e.target.checked)} /></div></Section>
          </div>
        </div>
      </main></div>
    </div>
  );
}
