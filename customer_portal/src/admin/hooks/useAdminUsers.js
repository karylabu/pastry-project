import { useCallback, useEffect, useMemo, useState } from "react";
import { ROOT_BASE } from "../../services/config";

const buildUsersUrl = ({ search = "", role = "all", page = 1, perPage = 10 }) => {
  const url = new URL(`${ROOT_BASE}/laravel/public/api/users`);

  if (search?.trim()) {
    url.searchParams.set("search", search.trim());
  }

  if (role && role !== "all") {
    url.searchParams.set("role", role);
  }

  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  if (perPage !== 10) {
    url.searchParams.set("per_page", String(perPage));
  }

  return url.toString();
};

export function useAdminUsers({ search = "", role = "all", page = 1 }) {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(buildUsersUrl({ search, role, page, perPage: 10 }));
      const payload = await response.json();

      if (Array.isArray(payload)) {
        setUsers(payload);
        setPagination(null);
      } else if (payload?.success === false) {
        throw new Error(payload.message || "Unable to load users.");
      } else {
        setUsers(payload.data ?? []);
        setPagination(payload.pagination ?? null);
      }
    } catch (err) {
      console.error(err);
      setError("Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, [page, role, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const metrics = useMemo(() => {
    const totalUsers = pagination?.total ?? users.length;

    const activeAccounts = users.filter((user) => String(user.status || "").toLowerCase() === "active").length;
    const suspendedAccounts = users.filter((user) => ["inactive", "banned"].includes(String(user.status || "").toLowerCase())).length;
    const activeStaff = users.filter((user) => ["admin", "manager", "staff"].includes(String(user.role || "").toLowerCase()) && String(user.status || "").toLowerCase() === "active").length;

    return [
      { label: "Total Users", value: totalUsers, tone: "default" },
      { label: "Active Staff", value: activeStaff, tone: "default" },
      { label: "Suspended Accounts", value: suspendedAccounts, tone: "accent" },
      { label: "Active Accounts", value: activeAccounts, tone: "default" },
    ];
  }, [pagination, users]);

  const handleStatusToggle = useCallback(async (userId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    const previousUsers = users;

    setUsers((currentUsers) =>
      currentUsers.map((user) => (user.id === userId ? { ...user, status: nextStatus } : user))
    );

    try {
      const response = await fetch(`${ROOT_BASE}/laravel/public/api_users.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", user_id: userId, status: nextStatus }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "Unable to update user status.");
      }
    } catch (err) {
      setUsers(previousUsers);

      if (err?.message === "Unable to update user status.") {
        setError("Unable to update user status.");
      } else {
        setError("Unable to update user status.");
      }
    }
  }, [users]);

  return {
    users,
    pagination,
    loading,
    error,
    metrics,
    handleStatusToggle,
    refetch: fetchUsers,
  };
}
