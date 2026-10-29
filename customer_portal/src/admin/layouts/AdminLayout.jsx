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

        .admin-page-surface [class*="fixed"][class*="inset-"]:has(> [role="dialog"], > [role="alertdialog"]),
        .admin-page-surface [class*="fixed"][class*="bottom-"][class*="top-"]:has(> [role="dialog"], > [role="alertdialog"]) {
          background-color: rgba(36, 24, 18, 0.55) !important;
          backdrop-filter: blur(2px);
        }

        .admin-page-surface [class*="fixed"][class*="inset-"] > [role="dialog"],
        .admin-page-surface [class*="fixed"][class*="inset-"] > [role="alertdialog"],
        .admin-page-surface [class*="fixed"][class*="bottom-"][class*="top-"] > [role="dialog"],
        .admin-page-surface [class*="fixed"][class*="bottom-"][class*="top-"] > [role="alertdialog"],
        .admin-page-surface [class*="fixed"][class*="inset-"][role="dialog"] > :not(img):not(button):not(svg),
        .admin-page-surface [class*="fixed"][class*="inset-"][role="alertdialog"] > :not(img):not(button):not(svg),
        .admin-page-surface [class*="fixed"][class*="bottom-"][class*="top-"][role="dialog"] > :not(img):not(button):not(svg),
        .admin-page-surface [class*="fixed"][class*="bottom-"][class*="top-"][role="alertdialog"] > :not(img):not(button):not(svg) {
          border: 1px solid #eadfd8 !important;
          border-radius: 8px !important;
          background-color: #fffdfa !important;
          box-shadow: 0 24px 70px rgba(38, 25, 16, 0.28) !important;
          color: #33251e;
        }

        .admin-page-surface [class*="fixed"][class*="inset-"] > [role="dialog"]:hover,
        .admin-page-surface [class*="fixed"][class*="inset-"] > [role="alertdialog"]:hover,
        .admin-page-surface [class*="fixed"][class*="bottom-"][class*="top-"] > [role="dialog"]:hover,
        .admin-page-surface [class*="fixed"][class*="bottom-"][class*="top-"] > [role="alertdialog"]:hover {
          transform: none !important;
          box-shadow: 0 24px 70px rgba(38, 25, 16, 0.28) !important;
        }

        .admin-page-surface :is(div, section, article, a)[class*="rounded-"][class*="border"][class*="p-"]:not([class*="border-dashed"]):not(.admin-product-card):not(.admin-product-card *):not(.admin-static-card):not([role="dialog"]):not([role="dialog"] *):not([role="alertdialog"]):not([role="alertdialog"] *) {
          border-right-color: var(--admin-card-border) !important;
          border-bottom-color: var(--admin-card-border) !important;
          border-left-color: var(--admin-card-border) !important;
          border-radius: 8px !important;
          box-shadow: var(--admin-card-shadow) !important;
          transition: transform 180ms ease, box-shadow 180ms ease;
        }

        .admin-page-surface :is(div, section, article, a)[class*="rounded-"][class*="border"][class*="p-"]:not([class*="border-dashed"]):not(.admin-product-card):not(.admin-product-card *):not(.admin-static-card):not([role="dialog"]):not([role="dialog"] *):not([role="alertdialog"]):not([role="alertdialog"] *):not([class*="border-t-"]) {
          border-top-color: var(--admin-card-accent) !important;
          border-top-style: solid !important;
          border-top-width: 3px !important;
        }

        .admin-page-surface :is(div, section, article, a)[class*="rounded-"][class*="border"][class*="p-"]:not([class*="border-dashed"]):not(.admin-product-card):not(.admin-product-card *):not(.admin-static-card):not([role="dialog"]):not([role="dialog"] *):not([role="alertdialog"]):not([role="alertdialog"] *):hover {
          outline: none !important;
          box-shadow: var(--admin-card-hover-shadow) !important;
          transform: translateY(-2px);
        }

        .admin-page-surface a[class*="rounded-"][class*="border"][class*="p-"]:focus-visible {
          outline: 2px solid #c9a94f;
          outline-offset: 2px;
          box-shadow: none !important;
        }

        @media (min-width: 600px) and (max-width: 767px) {
          .admin-page-surface,
          .admin-page-surface > * {
            min-width: 0;
            max-width: 100%;
          }

          .admin-page-surface :is(.grid, .flex) > * {
            min-width: 0;
          }

          .admin-page-surface :is(input, select, textarea) {
            min-width: 0;
            max-width: 100%;
          }

          .admin-page-surface table {
            display: block;
            max-width: 100%;
            overflow-x: auto;
          }

          .admin-page-surface :is(section, article)[class*="rounded-"][class*="border"][class*="p-"] {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}