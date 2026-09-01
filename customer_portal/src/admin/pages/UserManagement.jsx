import React, { useEffect, useState } from "react";
import { Eye, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { ROOT_BASE } from "../../services/config";
import { useAdminUsers } from "../hooks/useAdminUsers";

const roleStyles = {
  admin: "bg-[#1f1f1f] text-[#f1d06a]",
  manager: "bg-[#f4ebdc] text-[#7b5914]",
  staff: "bg-[#f7f3ea] text-[#5d4a2b]",
  customer: "bg-[#f2f2ef] text-[#57524c]",
};

function MetricCard({ label, value, tone }) {
  const toneClasses =
    tone === "accent"
      ? "bg-[#1f1f1f] text-white"
      : "border border-black/10 bg-white text-black";

  return (
    <div className={`rounded-[20px] p-3.5 shadow-[0_10px_30px_rgba(0,0,0,0.04)] ${toneClasses}`}>
      <p className={`text-[9px] font-semibold uppercase tracking-[0.26em] ${tone === "accent" ? "text-[#f1d06a]" : "text-black/55"}`}>
        {label}
      </p>
      <p className="mt-2 text-[20px] font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function RoleBadge({ role }) {
  const normalizedRole = String(role || "customer").toLowerCase();
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${roleStyles[normalizedRole] || roleStyles.customer}`}>
      {normalizedRole}
    </span>
  );
}

function StatusToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`inline-flex items-center gap-2 ${disabled ? "opacity-70" : "cursor-pointer"}`}
      role="switch"
      aria-checked={checked}
    >
      <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${checked ? "bg-[#1f1f1f]" : "bg-[#ddd5c7]"}`}>
        <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "translate-x-5" : "translate-x-1"}`} />
      </span>
      <span className={`text-[12px] font-medium capitalize ${checked ? "text-black" : "text-black/60"}`}>{checked ? "active" : "inactive"}</span>
    </button>
  );
}

const initialForm = {
  name: "",
  email: "",
  phone_number: "",
  role: "staff",
  status: "active",
  password: "",
  password_confirmation: "",
};

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState(initialForm);

  const { users, loading, error, metrics, handleStatusToggle, refetch } = useAdminUsers({
    search,
    role: roleFilter,
    page: 1,
  });

  useEffect(() => {
    if (!notice.message) return;
    const timer = window.setTimeout(() => setNotice({ type: "", message: "" }), 4000);
    return () => window.clearTimeout(timer);
  }, [notice.message]);

  useEffect(() => {
    if (error) {
      setNotice({ type: "error", message: error });
    } else {
      setNotice((current) => (current.type === "error" ? { type: "", message: "" } : current));
    }
  }, [error]);

  const showNotice = (type, message) => setNotice({ type, message });

  const resetForm = () => {
    setForm(initialForm);
    setFormErrors({});
  };

  const validateForm = (payload) => {
    const nextErrors = {};
    const trimmedName = payload.name.trim();
    const trimmedEmail = payload.email.trim();
    const trimmedPhone = payload.phone_number.trim();

    if (!trimmedName) {
      nextErrors.name = "Name is required.";
    }

    if (!trimmedEmail) {
      nextErrors.email = "Email is required.";
    } else if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      nextErrors.email = "Please enter a valid email address.";
    } else if (users.some((user) => user.id !== selectedUser?.id && String(user.email || "").trim().toLowerCase() === trimmedEmail.toLowerCase())) {
      nextErrors.email = "This email is already registered.";
    }

    if (trimmedPhone && !/^[0-9+()\-\s]{7,20}$/.test(trimmedPhone)) {
      nextErrors.phone_number = "Please enter a valid phone number.";
    }

    if (!["admin", "manager", "staff", "customer"].includes(payload.role)) {
      nextErrors.role = "Please choose a valid role.";
    }

    if (!["active", "inactive", "banned"].includes(payload.status)) {
      nextErrors.status = "Please choose a valid status.";
    }

    if (!selectedUser) {
      if (!payload.password) {
        nextErrors.password = "Password is required to create a user.";
      } else if (payload.password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters.";
      }
    } else {
      const originalUser = users.find((user) => user.id === selectedUser.id) || selectedUser;
      const hasChanges = [
        originalUser.name || "",
        originalUser.email || "",
        originalUser.phone_number || "",
        originalUser.role || "staff",
        originalUser.status || "active",
      ].join("|") !== [trimmedName, trimmedEmail, trimmedPhone, payload.role, payload.status].join("|");

      if (!hasChanges && !payload.password) {
        nextErrors.general = "No changes detected.";
      }
    }

    if (payload.password || payload.password_confirmation) {
      if (payload.password.length < 8) {
        nextErrors.password = "Password must be at least 8 characters.";
      }

      if (payload.password !== payload.password_confirmation) {
        nextErrors.password_confirmation = "Passwords do not match.";
      }
    }

    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      phone_number: form.phone_number.trim(),
      role: form.role,
      status: form.status,
      password: form.password,
      password_confirmation: form.password_confirmation,
    };

    const nextErrors = validateForm(payload);
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      showNotice("error", nextErrors.general || "Please fix the highlighted fields.");
      return;
    }

    setSavingUser(true);
    setFormErrors({});

    try {
      const url = selectedUser
        ? `${ROOT_BASE}/laravel/public/api/users/${selectedUser.id}`
        : `${ROOT_BASE}/laravel/public/api/users`;
      const method = selectedUser ? "PUT" : "POST";
      const bodyPayload = payload;

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 422 && data.errors) {
          const serverErrors = Object.entries(data.errors).reduce((acc, [key, value]) => {
            acc[key] = Array.isArray(value) ? value[0] : value;
            return acc;
          }, {});
          setFormErrors(serverErrors);
          showNotice("error", data.message || "Please review the form and try again.");
        } else if (response.status === 403) {
          showNotice("error", "You are not allowed to perform this action.");
        } else if (response.status === 404) {
          showNotice("error", "User not found.");
        } else {
          showNotice("error", data.message || "Unable to save user right now.");
        }
        return;
      }

      showNotice("success", selectedUser ? "User updated successfully." : "User created successfully.");
      setIsModalOpen(false);
      setSelectedUser(null);
      resetForm();
      refetch();
    } catch (error) {
      console.error(error);
      showNotice("error", "Unable to save user right now.");
    } finally {
      setSavingUser(false);
    }
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      phone_number: user.phone_number || "",
      role: user.role || "staff",
      status: user.status || "active",
      password: "",
      password_confirmation: "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const confirmDeleteUser = (user) => {
    setConfirmAction({
      type: "delete",
      user,
      title: "Delete user",
      message: `Delete ${user.name || "this user"}? This action cannot be undone.`,
    });
  };

  const confirmStatusChange = (user) => {
    const nextStatus = String(user.status || "").toLowerCase() === "active" ? "inactive" : "active";
    setConfirmAction({
      type: "status",
      user,
      title: nextStatus === "active" ? "Activate account" : "Deactivate account",
      message: `${nextStatus === "active" ? "Activate" : "Deactivate"} ${user.name || "this account"}?`,
    });
  };

  const executeConfirmAction = async () => {
    if (!confirmAction) return;

    if (confirmAction.type === "delete") {
      setDeletingUserId(confirmAction.user.id);
      try {
        const response = await fetch(`${ROOT_BASE}/laravel/public/api_users.php`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", user_id: confirmAction.user.id }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok || data.success === false) {
          showNotice("error", data.message || "Unable to delete user right now.");
          return;
        }

        showNotice("success", "User deleted successfully.");
        refetch();
      } catch (error) {
        console.error(error);
        showNotice("error", "Unable to delete user right now.");
      } finally {
        setDeletingUserId(null);
        setConfirmAction(null);
      }
      return;
    }

    setUpdatingStatusId(confirmAction.user.id);
    try {
      await handleStatusToggle(confirmAction.user.id, String(confirmAction.user.status || "").toLowerCase());
      showNotice("success", String(confirmAction.user.status || "").toLowerCase() === "active" ? "Account deactivated." : "Account activated.");
    } catch (error) {
      console.error(error);
      showNotice("error", "Unable to update account status right now.");
    } finally {
      setUpdatingStatusId(null);
      setConfirmAction(null);
    }
  };

  const handleQuickStatusToggle = (user) => {
    confirmStatusChange(user);
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="pt-[72px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-6 py-6 md:px-10">
          <section className="mb-5 rounded-[20px] border border-black/10 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#D4AF37]">Admin Workspace</p>
                <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-black sm:text-[24px]">User Management</h1>
                <p className="mt-2 text-[13px] leading-5 text-black/65">
                  Manage system permissions, active staff accounts, and customer access profiles from one polished console.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setSelectedUser(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-black px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-black/90"
              >
                <Plus size={16} />
                Add New User
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((item) => (
                <MetricCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
              ))}
            </div>
          </section>

          <section className="mb-5 rounded-[18px] border border-black/10 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-1 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2.5 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-100">
                <Search size={16} className="text-black/45" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name or email"
                  className="w-full bg-transparent text-[13px] text-black outline-none placeholder:text-black/40"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  className="rounded-full border border-black/10 bg-white px-3 py-2 text-[13px] text-black outline-none"
                >
                  <option value="all">Filter by Role</option>
                  <option value="admin">Admin</option>
                  <option value="manager">Manager</option>
                  <option value="staff">Staff</option>
                  <option value="customer">Customer</option>
                </select>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-[20px] border border-black/10 bg-white shadow-[0_10px_36px_rgba(0,0,0,0.05)]">
            {notice.message ? (
              <div className={`border-b border-black/10 px-5 py-3 text-[12px] ${notice.type === "success" ? "bg-[#f7fdf7] text-[#25633d]" : "bg-[#fff4f4] text-[#8b2e2e]"}`}>
                {notice.message}
              </div>
            ) : null}
            {error ? (
              <div className="border-b border-black/10 bg-[#fff4f4] px-5 py-3 text-[12px] text-[#8b2e2e]">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 border-b border-black/10 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-[15px] font-semibold text-black">Account Directory</h2>
                <p className="text-[12px] text-black/60">{users.length} records found</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 text-[12px] text-slate-600">
                <ShieldCheck size={16} />
                Secure access control
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-black/10 bg-slate-50 text-[11px] uppercase tracking-[0.24em] text-black/50">
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-black/60">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={16} className="animate-spin" />
                          Loading users…
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-10 text-center text-[12px] text-black/60">
                        No users found for the current search or filter.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-black/10 transition-colors duration-200 last:border-0 hover:bg-[#faf7ef]">
                        <td className="px-5 py-4">
                          <div className="font-medium text-black">{user.name}</div>
                          <div className="mt-1 text-[12px] text-black/50">{user.email}</div>
                        </td>
                        <td className="px-5 py-4">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-5 py-4">
                          <StatusToggle checked={String(user.status || "").toLowerCase() === "active"} onChange={() => handleQuickStatusToggle(user)} disabled={updatingStatusId === user.id} />
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openEditModal(user)} className="rounded-full p-2 text-black/70 transition hover:bg-black/5 hover:text-black" aria-label="Edit user">
                              <Pencil size={16} />
                            </button>
                            <button type="button" className="rounded-full p-2 text-black/70 transition hover:bg-black/5 hover:text-black" aria-label="View user">
                              <Eye size={16} />
                            </button>
                            <button type="button" onClick={() => confirmDeleteUser(user)} disabled={deletingUserId === user.id} className="rounded-full p-2 text-black/70 transition hover:bg-black/5 hover:text-black disabled:cursor-not-allowed disabled:opacity-60" aria-label="Delete user">
                              {deletingUserId === user.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-[24px] border border-black/10 bg-white p-6 shadow-xl">
            <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#D4AF37]">Confirm Action</p>
            <h3 className="mt-2 text-[18px] font-semibold text-black">{confirmAction.title}</h3>
            <p className="mt-2 text-[13px] leading-5 text-black/70">{confirmAction.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmAction(null)} className="rounded-full border border-black/10 px-4 py-2 text-[12px] font-medium text-black/70">
                Cancel
              </button>
              <button type="button" onClick={executeConfirmAction} className="rounded-full bg-black px-4 py-2 text-[12px] font-semibold text-white">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xl rounded-[24px] border border-black/10 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.32em] text-[#D4AF37]">Create Account</p>
                <h2 className="text-[18px] font-semibold text-black">{selectedUser ? "Edit User" : "Add New User"}</h2>
              </div>
              <button type="button" onClick={() => { setIsModalOpen(false); setSelectedUser(null); }} className="text-[12px] text-black/60">
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-black">Name</label>
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="w-full rounded-full border border-black/10 px-3 py-2 text-[13px] outline-none" />
                  {formErrors.name ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.name}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-black">Email</label>
                  <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="w-full rounded-full border border-black/10 px-3 py-2 text-[13px] outline-none" />
                  {formErrors.email ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.email}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-black">Phone</label>
                  <input value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} className="w-full rounded-full border border-black/10 px-3 py-2 text-[13px] outline-none" />
                  {formErrors.phone_number ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.phone_number}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-black">Role</label>
                  <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-full border border-black/10 px-3 py-2 text-[13px] outline-none">
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                    <option value="customer">Customer</option>
                  </select>
                  {formErrors.role ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.role}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-black">Status</label>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="w-full rounded-full border border-black/10 px-3 py-2 text-[13px] outline-none">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="banned">Banned</option>
                  </select>
                  {formErrors.status ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.status}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-[12px] font-medium text-black">Password</label>
                  <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="w-full rounded-full border border-black/10 px-3 py-2 text-[13px] outline-none" />
                  {formErrors.password ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.password}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[12px] font-medium text-black">Confirm Password</label>
                <input type="password" value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} className="w-full rounded-full border border-black/10 px-3 py-2 text-[13px] outline-none" />
                {formErrors.password_confirmation ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.password_confirmation}</p> : null}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); setSelectedUser(null); }} className="rounded-full border border-black/10 px-4 py-2 text-[12px] font-medium text-black/70">
                  Cancel
                </button>
                <button type="submit" disabled={savingUser} className="inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  {savingUser ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {selectedUser ? "Save Changes" : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
