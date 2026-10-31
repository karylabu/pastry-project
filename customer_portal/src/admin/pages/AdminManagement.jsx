import React from "react";
import { Link } from "react-router-dom";
import { History } from "lucide-react";
import UserManagement from "./UserManagement";

export default function AdminManagement() {
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Link
          to="/admin/activity-log"
          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#e8dfd4] bg-white px-3 text-xs font-semibold text-[#65574d] transition hover:border-[#c9a94f] hover:text-[#33251e]"
        >
          <History size={15} />
          View Audit Trail
        </Link>
      </div>
      <UserManagement adminOnly />
    </div>
  );
}
