import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, Pencil, Plus, Search, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { LARAVEL_BASE } from "../../services/config";
import { getAuthHeaders } from "../../services/api";
import { useAdminUsers } from "../hooks/useAdminUsers";
import AdminDialog from "../components/AdminDialog";
import UndoToast from "../components/UndoToast";

const roleStyles = {
  admin: "border border-[#f0dfa4] bg-[#fff4cd] text-[#80600a]",
  super_admin: "border border-[#e7c6ba] bg-[#fff0e8] text-[#9a4f32]",
  customer: "border border-[#e9e1d9] bg-[#f7f4ef] text-[#65574d]",
};

function MetricCard({ label, value, tone }) {
  const accent = tone === "accent" ? "border-t-[#c87954]" : "border-t-[#d4af37]";

  return (
    <div className={`rounded-lg border border-[#e9e1d9] border-t-[3px] ${accent} bg-white px-4 py-3.5 shadow-[0_3px_12px_rgba(60,42,28,0.035)]`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#74675f]">
        {label}
      </p>
      <p className="mt-2 text-[25px] font-bold leading-none text-[#33251e]">{value}</p>
    </div>
  );
}

function RoleBadge({ role }) {
  const normalizedRole = String(role || "customer").toLowerCase();
  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-[10px] font-semibold capitalize ${roleStyles[normalizedRole] || roleStyles.customer}`}>
      {normalizedRole.replace("_", " ")}
    </span>
  );
}

function StatusToggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className={`inline-flex items-center gap-2 ${disabled ? "cursor-wait opacity-70" : "cursor-pointer"}`}
      role="switch"
      aria-checked={checked}
      aria-label={`Account ${checked ? "active" : "inactive"}`}
    >
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${checked ? "bg-[#81906c]" : "bg-[#c8c0b6]"}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
      </span>
      <span className={`text-[11px] font-medium capitalize ${checked ? "text-[#61734f]" : "text-[#8f8076]"}`}>{checked ? "active" : "inactive"}</span>
    </button>
  );
}

const initialForm = {
  name: "",
  email: "",
  phone_number: "",
  role: "admin",
  status: "active",
  password: "",
  password_confirmation: "",
};

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [loadingViewedUser, setLoadingViewedUser] = useState(false);
  const [viewUserError, setViewUserError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [savingUser, setSavingUser] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState(null);
  const [confirmAction, setConfirmAction] = useState(null);
  const [adminDialog, setAdminDialog] = useState(null);
  const [undoEntry, setUndoEntry] = useState(null);
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [formErrors, setFormErrors] = useState({});
  const [form, setForm] = useState(initialForm);

  const { users, pagination, loading, error, metrics, handleStatusToggle, refetch } = useAdminUsers({
    search,
    role: roleFilter,
    page,
  });

  const currentPage = Number(pagination?.current_page || page);
  const lastPage = Math.max(1, Number(pagination?.last_page || 1));
  const perPage = Number(pagination?.per_page || 10);
  const totalRecords = Number(pagination?.total ?? users.length);
  const firstRecord = totalRecords ? (currentPage - 1) * perPage + 1 : 0;
  const lastRecord = Math.min(currentPage * perPage, totalRecords);

  useEffect(() => {
    if (pagination && page > lastPage) setPage(lastPage);
  }, [lastPage, page, pagination]);

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

  const handleViewUser = async (user) => {
    setLoadingViewedUser(true);
    setViewUserError("");
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/users/${user.id}`, {
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load user details.");
      }
      setViewingUser(data.data);
    } catch (error) {
      setViewUserError(error.message || "Unable to load user details.");
      setViewingUser(user);
    } finally {
      setLoadingViewedUser(false);
    }
  };

  const resetForm = () => {
    setForm(initialForm);
    setFormErrors({});
    setShowPassword(false);
    setShowPasswordConfirmation(false);
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

    if (selectedUser ? !["admin", "super_admin", "customer"].includes(payload.role) : !["admin", "super_admin"].includes(payload.role)) {
      nextErrors.role = selectedUser ? "Please choose a valid role." : "New managed accounts must be admins.";
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
        originalUser.role || "customer",
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
        ? `${LARAVEL_BASE}/api/users/${selectedUser.id}`
        : `${LARAVEL_BASE}/api/users`;
      const method = selectedUser ? "PUT" : "POST";
      const bodyPayload = payload;

      const response = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
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
    setShowPassword(false);
    setShowPasswordConfirmation(false);
    setForm({
      name: user.name || "",
      email: user.email || "",
      phone_number: user.phone_number || "",
      role: user.role || "customer",
      status: user.status || "active",
      password: "",
      password_confirmation: "",
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const confirmDeleteUser = (user) => {
    setAdminDialog({
      kind: "confirm",
      title: "Move account to Recycle Bin?",
      message: `${user.name || "This account"} will be hidden and moved to the Recycle Bin. You can Undo for 5 seconds or restore it from Settings within 30 days.`,
      confirmLabel: "Move to Recycle Bin",
      onConfirm: () => deleteUser(user),
    });
  };

  const deleteUser = async (user) => {
    setDeletingUserId(user.id);
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/users/${user.id}`, {
        method: "DELETE",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        showNotice("error", data.message || "Unable to delete user right now.");
        return;
      }

      setUndoEntry({ id: data.recycle_bin_entry_id, label: user.name || "Account" });
      showNotice("success", "User moved to the Recycle Bin.");
      refetch();
    } catch (error) {
      console.error(error);
      showNotice("error", "Unable to delete user right now.");
    } finally {
      setDeletingUserId(null);
    }
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

  const undoUserDelete = async () => {
    if (!undoEntry?.id) return;
    try {
      const response = await fetch(`${LARAVEL_BASE}/api/admin/recycle-bin/${undoEntry.id}/restore`, {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", ...getAuthHeaders() },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to restore this account.");
      setUndoEntry(null);
      showNotice("success", `${undoEntry.label} restored.`);
      refetch();
    } catch (restoreError) {
      showNotice("error", restoreError.message || "Unable to restore this account.");
    }
  };

  const handleQuickStatusToggle = (user) => {
    confirmStatusChange(user);
  };

  const openCreateModal = (role = "admin") => {
    resetForm();
    setSelectedUser(null);
    setForm({
      ...initialForm,
      role,
      ...(role === "super_admin" ? { name: "SUPER ADMIN", email: "superadmin@pastry.com" } : {}),
    });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e]">
      <div className="pt-[88px] lg:pl-[260px]">
        <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6 md:px-8 lg:px-10 lg:py-7">
          <div className="mb-6 flex min-h-[72px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.24em] text-[#92701e]">Access control</p>
              <h1 className="mt-1 font-serif text-[27px] leading-tight text-[#33251e]">User Management</h1>
              <p className="mt-1 text-[12px] text-[#74675f]">Manage account access, roles, and status.</p>
            </div>
            <div className="flex flex-wrap gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => openCreateModal("admin")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#33251e] px-4 text-[12px] font-semibold text-white transition hover:bg-[#5b4540]"
              >
                <Plus size={15} />
                Add Admin
              </button>
              <button
                type="button"
                onClick={() => openCreateModal("super_admin")}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d9c4b8] bg-white px-4 text-[12px] font-semibold text-[#7d4630] transition hover:bg-[#fff6f1]"
              >
                <ShieldCheck size={15} />
                Add Super Admin
              </button>
            </div>
          </div>

          <section className="admin-user-management-metrics mb-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} tone={item.tone} />
            ))}
          </section>

          <section className="mb-4 rounded-lg border border-[#e9e1d9] bg-white p-3 shadow-[0_3px_12px_rgba(60,42,28,0.035)] sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
              <label className="relative block">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9b8c83]" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or email"
                  aria-label="Search users by name or email"
                  className="h-10 w-full rounded-lg border border-[#e8dfd4] bg-white pl-9 pr-3 text-[12px] text-[#33251e] outline-none transition placeholder:text-[#a99a8e] focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15"
                />
              </label>
              <select
                value={roleFilter}
                onChange={(event) => {
                  setRoleFilter(event.target.value);
                  setPage(1);
                }}
                aria-label="Filter users by role"
                className="h-10 rounded-lg border border-[#e8dfd4] bg-white px-3 text-[12px] text-[#33251e] outline-none transition focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15"
              >
                <option value="all">All roles</option>
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
                <option value="customer">Customer</option>
              </select>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[#e9e1d9] bg-white shadow-[0_3px_12px_rgba(60,42,28,0.035)]">
            {notice.message ? (
              <div role="status" className={`border-b px-4 py-3 text-[12px] sm:px-5 ${notice.type === "success" ? "border-[#d8e7d5] bg-[#edf5eb] text-[#4f7654]" : "border-[#efd8d4] bg-[#fff0f0] text-[#8d5357]"}`}>
                {notice.message}
              </div>
            ) : null}
            {error ? (
              <div role="alert" className="border-b border-[#efd8d4] bg-[#fff0f0] px-4 py-3 text-[12px] text-[#8d5357] sm:px-5">
                {error}
              </div>
            ) : null}

            <div className="flex flex-col gap-2 border-b border-[#f0e9e2] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h2 className="text-[13px] font-semibold text-[#33251e]">Account directory</h2>
                <p className="mt-0.5 text-[11px] text-[#8f8076]">{totalRecords.toLocaleString()} total accounts</p>
              </div>
              <div className="inline-flex items-center gap-2 text-[11px] text-[#74675f]">
                <ShieldCheck size={15} className="text-[#9b7810]" />
                Role-based access
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-[680px] w-full text-left text-[12px]">
                <thead>
                  <tr className="border-b border-[#f0e9e2] bg-[#fbf7f2] text-[9px] uppercase tracking-[0.14em] text-[#9b8c83]">
                    <th className="px-4 py-3 font-semibold sm:px-5">User</th>
                    <th className="px-4 py-3 font-semibold sm:px-5">Role</th>
                    <th className="px-4 py-3 font-semibold sm:px-5">Status</th>
                    <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right font-semibold sm:px-5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-10 text-center text-[12px] text-[#74675f]" role="status">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 size={15} className="animate-spin text-[#92701e]" />
                          Loading users...
                        </div>
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-5 py-12 text-center text-[12px] text-[#74675f]">
                        No users found for the current search or filter.
                      </td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id} className="border-b border-[#f0e9e2] last:border-0 hover:bg-[#fffaf0]">
                        <td className="px-4 py-3.5 sm:px-5">
                          <div className="font-semibold text-[#33251e]">{user.name}</div>
                          <div className="mt-0.5 text-[11px] text-[#8f8076]">{user.email}</div>
                        </td>
                        <td className="px-4 py-3.5 sm:px-5">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="px-4 py-3.5 sm:px-5">
                          <StatusToggle checked={String(user.status || "").toLowerCase() === "active"} onChange={() => handleQuickStatusToggle(user)} disabled={updatingStatusId === user.id} />
                        </td>
                        <td className="w-[1%] whitespace-nowrap px-4 py-3.5 text-right sm:px-5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" onClick={() => openEditModal(user)} className="rounded-md p-2 text-[#74675f] transition hover:bg-[#fff4cd] hover:text-[#80600a]" aria-label={`Edit ${user.name}`} title="Edit user">
                              <Pencil size={16} />
                            </button>
                            <button type="button" onClick={() => handleViewUser(user)} disabled={loadingViewedUser} className="rounded-md p-2 text-[#74675f] transition hover:bg-[#fff4cd] hover:text-[#80600a] disabled:opacity-60" aria-label={`View ${user.name}`} title="View user">
                              <Eye size={16} />
                            </button>
                            <button type="button" onClick={() => confirmDeleteUser(user)} disabled={deletingUserId === user.id} className="rounded-md p-2 text-[#8d5357] transition hover:bg-[#fff0f0] disabled:cursor-not-allowed disabled:opacity-60" aria-label={`Delete ${user.name}`} title="Delete user">
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
            {lastPage > 1 ? (
              <div className="flex flex-col gap-3 border-t border-[#f0e9e2] bg-[#fcfaf7] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <p className="text-[11px] text-[#8f8076]" aria-live="polite">
                  Showing {firstRecord}–{lastRecord} of {totalRecords.toLocaleString()} users · Page {currentPage} of {lastPage}
                </p>
                <div className="flex gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={currentPage <= 1 || loading}
                    aria-label="Previous users page"
                    title="Previous page"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#5f514a] transition hover:border-[#c9a94f] hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.min(lastPage, current + 1))}
                    disabled={currentPage >= lastPage || loading}
                    aria-label="Next users page"
                    title="Next page"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#e8dfd4] bg-white text-[#5f514a] transition hover:border-[#c9a94f] hover:bg-[#fffaf0] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronRight size={17} />
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </div>

      {viewingUser && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#241812]/55 px-4 py-5 backdrop-blur-[2px]" onClick={() => { setViewingUser(null); setViewUserError(""); }}>
          <section className="w-full max-w-md rounded-lg border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_24px_70px_rgba(38,25,16,0.28)]" role="dialog" aria-modal="true" aria-labelledby="view-user-title" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#92701e]">Account details</p>
                <h2 id="view-user-title" className="mt-1 text-[18px] font-semibold text-[#33251e]">{loadingViewedUser ? "Loading account..." : viewingUser.name}</h2>
              </div>
              <button type="button" onClick={() => { setViewingUser(null); setViewUserError(""); }} className="rounded-md border border-[#e8dfd4] px-3 py-2 text-[11px] font-medium text-[#65574d] transition hover:bg-[#fbf7f2]">Close</button>
            </div>
            {viewUserError ? <p role="status" className="mt-3 rounded-md border border-[#efd8d4] bg-[#fff0f0] px-3 py-2 text-[11px] text-[#8d5357]">{viewUserError} Showing the available directory record.</p> : null}
            <dl className="mt-5 divide-y divide-[#f0e9e2] text-[12px]">
              <div className="flex justify-between gap-4 py-3 first:pt-0"><dt className="text-[#8f8076]">Email</dt><dd className="break-all text-right font-medium text-[#33251e]">{viewingUser.email || "Not provided"}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[#8f8076]">Phone</dt><dd className="text-right font-medium text-[#33251e]">{viewingUser.phone_number || viewingUser.phone || "Not provided"}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[#8f8076]">Role</dt><dd className="capitalize font-medium text-[#33251e]">{String(viewingUser.role || "customer").replace("_", " ")}</dd></div>
              <div className="flex justify-between gap-4 py-3"><dt className="text-[#8f8076]">Status</dt><dd className="capitalize font-medium text-[#33251e]">{viewingUser.status || "active"}</dd></div>
              <div className="flex justify-between gap-4 py-3 last:pb-0"><dt className="text-[#8f8076]">Joined</dt><dd className="text-right font-medium text-[#33251e]">{viewingUser.created_at ? new Date(viewingUser.created_at).toLocaleDateString() : "Not available"}</dd></div>
            </dl>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#241812]/55 px-4 py-5 backdrop-blur-[2px]">
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title" className="w-full max-w-md rounded-lg border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_24px_70px_rgba(38,25,16,0.28)]">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#92701e]">Confirm action</p>
            <h3 id="confirm-action-title" className="mt-2 text-[18px] font-semibold text-[#33251e]">{confirmAction.title}</h3>
            <p className="mt-2 text-[13px] leading-5 text-[#74675f]">{confirmAction.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmAction(null)} className="rounded-md border border-[#e8dfd4] px-4 py-2 text-[12px] font-medium text-[#65574d] transition hover:bg-[#fbf7f2]">
                Cancel
              </button>
              <button type="button" onClick={executeConfirmAction} className="rounded-md bg-[#33251e] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#5b4540]">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
      <AdminDialog
        dialog={adminDialog}
        onClose={() => setAdminDialog(null)}
        onConfirm={() => {
          const action = adminDialog?.onConfirm;
          setAdminDialog(null);
          action?.();
        }}
      />
      <UndoToast
        message={undoEntry ? `${undoEntry.label} moved to the Recycle Bin.` : ""}
        onUndo={undoUserDelete}
        onDismiss={() => setUndoEntry(null)}
      />

      {isModalOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#241812]/55 px-4 py-5 backdrop-blur-[2px]">
          <div role="dialog" aria-modal="true" aria-labelledby="user-form-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-lg border border-[#eadfd8] bg-[#fffdfa] p-5 shadow-[0_24px_70px_rgba(38,25,16,0.28)] sm:p-6">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#92701e]">Account</p>
                <h2 id="user-form-title" className="text-[18px] font-semibold text-[#33251e]">{selectedUser ? "Edit User" : form.role === "super_admin" ? "Add Super Admin" : "Add Admin"}</h2>
              </div>
              <button type="button" onClick={() => { setIsModalOpen(false); setSelectedUser(null); }} className="rounded-md border border-[#e8dfd4] px-3 py-2 text-[11px] font-medium text-[#65574d] transition hover:bg-[#fbf7f2]">
                Close
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#65574d]">Name</label>
                  <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="h-10 w-full rounded-md border border-[#e8dfd4] px-3 text-[12px] text-[#33251e] outline-none transition focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15" />
                  {formErrors.name ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.name}</p> : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#65574d]">Email</label>
                  <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="h-10 w-full rounded-md border border-[#e8dfd4] px-3 text-[12px] text-[#33251e] outline-none transition focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15" />
                  {formErrors.email ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.email}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#65574d]">Phone</label>
                  <input value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} className="h-10 w-full rounded-md border border-[#e8dfd4] px-3 text-[12px] text-[#33251e] outline-none transition focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15" />
                  {formErrors.phone_number ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.phone_number}</p> : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#65574d]">Role</label>
                  <select aria-label="Role" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="h-10 w-full rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] text-[#33251e] outline-none transition focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15">
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                    {selectedUser && <option value="customer">Customer</option>}
                  </select>
                  {formErrors.role ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.role}</p> : null}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#65574d]">Status</label>
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="h-10 w-full rounded-md border border-[#e8dfd4] bg-white px-3 text-[12px] text-[#33251e] outline-none transition focus:border-[#b89646] focus:ring-2 focus:ring-[#d4af37]/15">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="banned">Banned</option>
                  </select>
                  {formErrors.status ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.status}</p> : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-[11px] font-medium text-[#65574d]">Password</label>
                  <div className="flex h-10 items-center rounded-md border border-[#e8dfd4] bg-white pr-3 transition focus-within:border-[#b89646] focus-within:ring-2 focus-within:ring-[#d4af37]/15">
                    <input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="admin-password-input h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-[12px] text-[#33251e] outline-none" />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="text-[#8f8076] transition hover:text-[#33251e]" aria-label={showPassword ? "Hide password" : "Show password"}>
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {formErrors.password ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.password}</p> : null}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-[11px] font-medium text-[#65574d]">Confirm Password</label>
                <div className="flex h-10 items-center rounded-md border border-[#e8dfd4] bg-white pr-3 transition focus-within:border-[#b89646] focus-within:ring-2 focus-within:ring-[#d4af37]/15">
                  <input type={showPasswordConfirmation ? "text" : "password"} value={form.password_confirmation} onChange={(event) => setForm({ ...form, password_confirmation: event.target.value })} className="admin-password-input h-full min-w-0 flex-1 rounded-md bg-transparent px-3 text-[12px] text-[#33251e] outline-none" />
                  <button type="button" onClick={() => setShowPasswordConfirmation((visible) => !visible)} className="text-[#8f8076] transition hover:text-[#33251e]" aria-label={showPasswordConfirmation ? "Hide confirm password" : "Show confirm password"}>
                    {showPasswordConfirmation ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {formErrors.password_confirmation ? <p className="mt-1 text-[11px] text-[#8b2e2e]">{formErrors.password_confirmation}</p> : null}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setIsModalOpen(false); setSelectedUser(null); }} className="rounded-md border border-[#e8dfd4] px-4 py-2 text-[12px] font-medium text-[#65574d] transition hover:bg-[#fbf7f2]">
                  Cancel
                </button>
                <button type="submit" disabled={savingUser} className="inline-flex items-center gap-2 rounded-md bg-[#33251e] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#5b4540] disabled:cursor-not-allowed disabled:opacity-60">
                  {savingUser ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  {selectedUser ? "Save Changes" : form.role === "super_admin" ? "Create Super Admin" : "Create Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
