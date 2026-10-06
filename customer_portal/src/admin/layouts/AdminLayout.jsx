import { useState } from "react";
import AdminNavbar from "../components/AdminNavbar";
import AdminChatBubble from "../components/AdminChatBubble";

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

  return (
    <div className={`admin-shell min-h-screen bg-[#fbfaf5] font-['DM_Sans'] text-[#33251e] ${sidebarOpen ? "admin-sidebar-open" : "admin-sidebar-closed"}`}>
      <AdminNavbar onSidebarChange={setSidebarOpen} />
      <main className="admin-page-surface min-h-screen bg-[#fbfaf5]">
        {children}
      </main>
      <AdminChatBubble />
      <style>{`
        .admin-shell {
          --admin-action-bg: #33251e;
          --admin-action-hover: #5b4540;
          --admin-card-border: #e9e1d9;
          --admin-card-accent: #c9a94f;
          --admin-card-shadow: 0 3px 12px rgba(60, 42, 28, 0.035);
          --admin-card-hover-shadow: 0 10px 24px rgba(60, 42, 28, 0.15);
        }

        .admin-sidebar-closed .admin-page-surface [class~="lg:pl-[260px]"] {
          padding-left: 0 !important;
        }

        .admin-shell button:is(
          [class~="bg-black"],
          [class~="bg-slate-900"],
          [class~="bg-[#33251e]"],
          [class~="bg-[#f5c451]"]
        ) {
          background-color: var(--admin-action-bg) !important;
          color: #fff !important;
        }

        .admin-shell button:is(
          [class~="bg-black"],
          [class~="bg-slate-900"],
          [class~="bg-[#33251e]"],
          [class~="bg-[#f5c451]"]
        ):hover:not(:disabled) {
          background-color: var(--admin-action-hover) !important;
        }

        .admin-page-surface > * {
          background: #fbfaf5 !important;
        }

        .admin-page-surface :is(div, section, article, a)[class*="rounded-"][class*="border"][class*="p-"]:not([class*="border-dashed"]):not(.admin-product-card):not(.admin-product-card *) {
          border-right-color: var(--admin-card-border) !important;
          border-bottom-color: var(--admin-card-border) !important;
          border-left-color: var(--admin-card-border) !important;
          border-radius: 8px !important;
          box-shadow: var(--admin-card-shadow) !important;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .admin-page-surface :is(div, section, article, a)[class*="rounded-"][class*="border"][class*="p-"]:not([class*="border-dashed"]):not(.admin-product-card):not(.admin-product-card *):not([class*="border-t-"]) {
          border-top-color: var(--admin-card-accent) !important;
          border-top-style: solid !important;
          border-top-width: 3px !important;
        }

        .admin-page-surface :is(div, section, article, a)[class*="rounded-"][class*="border"][class*="p-"]:not([class*="border-dashed"]):not(.admin-product-card):not(.admin-product-card *):hover {
          outline: none !important;
          box-shadow: var(--admin-card-hover-shadow) !important;
          transform: translateY(-2px);
        }

        .admin-page-surface a[class*="rounded-"][class*="border"][class*="p-"]:focus-visible {
          outline: 2px solid #c9a94f;
          outline-offset: 2px;
          box-shadow: none !important;
        }
      `}</style>
    </div>
  );
}