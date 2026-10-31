import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Building2, Check, Clock3, Database, Eye, EyeOff, KeyRound, LogOut, RotateCcw, Save, Trash2, UserCircle2, X } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";

const defaultPreferences = {
  shopName: "Pastry Project",
  shopEmail: "",
  shopPhone: "",
  shopAddress: "",
  openingHours: "08:00 - 20:00",
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

function Field({ label, value, onChange, type = "text", placeholder = "", min, max, step }) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";

  return (
    <label className="block">
      <span className="text-[10px] font-semibold text-[#65574d]">{label}</span>
      <span className="mt-1.5 flex h-10 w-full items-center rounded-md border border-[#e8dfd4] bg-white transition focus-within:border-[#b89646] focus-within:ring-2 focus-within:ring-[#d4af37]/15">
        <input type={isPassword && showPassword ? "text" : type} value={value} onChange={onChange} placeholder={placeholder} min={min} max={max} step={step} className={`${isPassword ? "admin-password-input" : ""} h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-[12px] text-[#33251e] outline-none placeholder:text-[#a99a8e]`} />
        {isPassword && (
          <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="mr-3 text-[#8f8076] transition hover:text-[#33251e]" aria-label={`${showPassword ? "Hide" : "Show"} ${label.toLowerCase()}`}>
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </span>
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
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getUser());
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [profile, setProfile] = useState({ full_name: "", email: "", phone: "" });
  const [password, setPassword] = useState({ current_password: "", new_password: "", confirm_password: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [recycleItems, setRecycleItems] = useState([]);
  const [recycleLoading, setRecycleLoading] = useState(false);
  const [recycleError, setRecycleError] = useState("");
  const [recycleActionId, setRecycleActionId] = useState(null);

  useEffect(() => {
    if (user) setProfile({ full_name: user.name || "", email: user.email || "", phone: user.phone || "" });
  }, [user]);

  useEffect(() => {
    let active = true;
    const loadSettings = async () => {
      setSettingsLoading(true);
      try {
        const response = await fetch(`${LARAVEL_BASE}/api/admin/settings`, {
          credentials: "include",
          headers: { Accept: "application/json", ...getAuthHeaders() },
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.message || "Unable to load settings.");
        if (active) {
          setPreferences({
            ...defaultPreferences,
            ...data.settings,
            ...data.notification_preferences,
          });
          setSettingsLoaded(true);
          setError("");
        }
      } catch (loadError) {
        if (active) setError(loadError.message);
      } finally {
        if (active) setSettingsLoading(false);
      }
    };

    loadSettings();
    return () => { active = false; };
  }, []);

  const updatePreference = (key, value) => setPreferences((current) => ({ ...current, [key]: value }));
  const savePreferences = async () => {
    setSavingPreferences(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          settings: {
            shopName: preferences.shopName,
            shopEmail: preferences.shopEmail,
            shopPhone: preferences.shopPhone,
            shopAddress: preferences.shopAddress,
            openingHours: preferences.openingHours,
            minimumOrder: preferences.minimumOrder,
            preparationTime: preferences.preparationTime,
            lowStockThreshold: preferences.lowStockThreshold,
          },
          notification_preferences: {
            orderAlerts: preferences.orderAlerts,
            lowStockAlerts: preferences.lowStockAlerts,
            messageAlerts: preferences.messageAlerts,
            promotionAlerts: preferences.promotionAlerts,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to save settings.");
      setPreferences({
        ...defaultPreferences,
        ...data.settings,
        ...data.notification_preferences,
      });
      window.dispatchEvent(new CustomEvent("admin-settings-updated", {
        detail: { notificationPreferences: data.notification_preferences },
      }));
      setNotice("Settings saved successfully.");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingPreferences(false);
    }
  };

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

  const loadRecycleBin = async () => {
    setRecycleLoading(true);
    setRecycleError("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/recycle-bin`, {
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load the Recycle Bin.");
      setRecycleItems(data.items || []);
    } catch (loadError) {
      setRecycleError(loadError.message);
    } finally {
      setRecycleLoading(false);
    }
  };

  const openRecycleBin = () => {
    setRecycleBinOpen(true);
    loadRecycleBin();
  };

  const restoreRecycleItem = async (item) => {
    setRecycleActionId(item.id);
    setRecycleError("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/recycle-bin/${item.id}/restore`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to restore this item.");
      setNotice(`${item.label} restored successfully.`);
      await loadRecycleBin();
    } catch (restoreError) {
      setRecycleError(restoreError.message);
    } finally {
      setRecycleActionId(null);
    }
  };

  const permanentlyDeleteRecycleItem = async (item) => {
    if (!window.confirm(`Permanently delete "${item.label}"? This cannot be undone.`)) return;
    setRecycleActionId(item.id);
    setRecycleError("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/recycle-bin/${item.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to permanently delete this item.");
      setNotice(`${item.label} permanently deleted.`);
      await loadRecycleBin();
    } catch (deleteError) {
      setRecycleError(deleteError.message);
    } finally {
      setRecycleActionId(null);
    }
  };

  const confirmLogout = () => {
    const token = getUser()?.token || "";
    fetch(`${LARAVEL_BASE}/staff/logout.php`, {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch((logoutError) => console.warn("Logout request failed:", logoutError)).finally(() => {
      localStorage.removeItem("user");
      localStorage.removeItem("auth_token");
      navigate("/admin/login", { replace: true });
    });
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div className="pt-[88px] lg:pl-[260px]">
        <main className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-6 flex min-h-[72px] flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">System</p>
              <h1 className="mt-1 font-serif text-[27px] leading-tight text-[#33251e]">Admin Settings</h1>
              <p className="mt-1 text-[12px] text-[#74675f]">Manage your account and operating preferences.</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 self-start sm:items-end sm:self-auto">
              <div className="mr-1 flex min-w-0 items-center gap-2 text-[11px] text-[#74675f]">
                <UserCircle2 size={16} className="shrink-0 text-[#9b7810]" />
                <span className="max-w-[180px] truncate font-medium text-[#33251e]">{user?.name || "Admin account"}</span>
                <span className="text-[#8f8076]">· {user?.role || "admin"}</span>
              </div>
              <button type="button" onClick={() => setLogoutConfirmOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#efd8d4] px-3 text-[11px] font-semibold text-[#8d5357] transition hover:bg-[#fff0f0]"><LogOut size={14} /> Log out</button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => navigate("/admin/backups")} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#e8dfd4] bg-white px-3 text-[11px] font-semibold text-[#65574d] transition hover:border-[#c9a94f] hover:bg-[#fffaf0]"><Database size={14} /> Backup Management</button>
                <button type="button" onClick={openRecycleBin} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#efd8d4] bg-white px-3 text-[11px] font-semibold text-[#8d5357] transition hover:bg-[#fff0f0]"><Trash2 size={14} /> Recycle Bin</button>
                <button type="button" onClick={savePreferences} disabled={settingsLoading || !settingsLoaded || savingPreferences} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#33251e] px-4 text-[12px] font-semibold text-white transition hover:bg-[#5b4540] disabled:cursor-not-allowed disabled:opacity-60"><Save size={15} /> {settingsLoading ? "Loading settings..." : savingPreferences ? "Saving..." : settingsLoaded ? "Save settings" : "Settings unavailable"}</button>
              </div>
            </div>
          </div>

          {(notice || error) && <div role="status" className={`mb-4 flex items-center gap-2 rounded-lg border px-4 py-3 text-[12px] ${error ? "border-[#efd8d4] bg-[#fff0f0] text-[#8d5357]" : "border-[#d8e7d5] bg-[#edf5eb] text-[#4f7654]"}`}><Check size={15} />{error || notice}</div>}

          {recycleBinOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#211812]/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setRecycleBinOpen(false); }}>
              <section role="dialog" aria-modal="true" aria-labelledby="recycle-bin-title" className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-xl border border-[#eadfd8] bg-white shadow-2xl">
                <header className="flex items-center justify-between border-b border-[#f0e9e2] px-5 py-4">
                  <div>
                    <h2 id="recycle-bin-title" className="font-serif text-lg text-[#33251e]">Recycle Bin</h2>
                    <p className="mt-1 text-[11px] text-[#74675f]">Items are automatically removed after 30 days.</p>
                  </div>
                  <button type="button" onClick={() => setRecycleBinOpen(false)} aria-label="Close Recycle Bin" className="grid h-9 w-9 place-items-center rounded-full text-[#74675f] hover:bg-[#f8f3ee]"><X size={17} /></button>
                </header>
                <div className="max-h-[65vh] overflow-y-auto p-4 sm:p-5">
                  {recycleError && <p role="alert" className="mb-3 rounded-lg border border-[#efd8d4] bg-[#fff0f0] px-3 py-2 text-[12px] text-[#8d5357]">{recycleError}</p>}
                  {recycleLoading ? <p className="py-10 text-center text-sm text-[#74675f]">Loading deleted items...</p>
                    : recycleItems.length === 0 ? <p className="py-10 text-center text-sm text-[#74675f]">Recycle Bin is empty.</p>
                      : <ul className="space-y-2">{recycleItems.map((item) => (
                        <li key={item.id} className="flex flex-col gap-3 rounded-lg border border-[#eee5dd] p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-[#33251e]">{item.label}</p>
                            <p className="mt-1 text-[10px] capitalize text-[#8f8076]">{item.type.replaceAll("_", " ")} · expires {new Date(item.expires_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button type="button" disabled={recycleActionId !== null} onClick={() => restoreRecycleItem(item)} className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#edf5eb] px-3 text-[11px] font-semibold text-[#4f7654] disabled:opacity-50"><RotateCcw size={13} /> Restore</button>
                            <button type="button" disabled={recycleActionId !== null} onClick={() => permanentlyDeleteRecycleItem(item)} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#efd8d4] px-3 text-[11px] font-semibold text-[#8d5357] disabled:opacity-50"><Trash2 size={13} /> Delete</button>
                          </div>
                        </li>
                      ))}</ul>}
                </div>
              </section>
            </div>
          )}

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
                <Field label="Opening hours (24-hour, HH:MM - HH:MM)" value={preferences.openingHours} placeholder="08:00 - 00:00" onChange={(e) => updatePreference("openingHours", e.target.value)} />
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
                <Field label="Minimum order subtotal (₱)" type="number" min="0" step="0.01" value={preferences.minimumOrder} onChange={(e) => updatePreference("minimumOrder", e.target.value)} />
                <Field label="Estimated prep. minutes" type="number" min="1" max="1440" step="1" value={preferences.preparationTime} onChange={(e) => updatePreference("preparationTime", e.target.value)} />
                <Field label="Product low-stock alert threshold" type="number" min="0" step="1" value={preferences.lowStockThreshold} onChange={(e) => updatePreference("lowStockThreshold", e.target.value)} />
                <p className="text-[10px] leading-4 text-[#8f8076] sm:col-span-2 xl:col-span-4">The minimum applies to the cart subtotal before discounts. Product low-stock alerts use this shared threshold; ingredients keep their individual thresholds.</p>
              </div>
            </Section>
          </div>
        </main>
      </div>
      {logoutConfirmOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#241812]/55 px-4 py-5 backdrop-blur-[2px]" onClick={() => setLogoutConfirmOpen(false)}>
          <section role="alertdialog" aria-modal="true" aria-labelledby="logout-confirm-title" aria-describedby="logout-confirm-description" className="w-full max-w-md rounded-lg border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_24px_70px_rgba(38,25,16,0.28)]" onClick={(event) => event.stopPropagation()}>
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
