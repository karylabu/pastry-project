import AdminNavbar from "../components/AdminNavbar";

export default function AdminLayout({ children }) {
  return (
    <div className="admin-shell min-h-screen bg-[#f5f3ee] text-slate-900">
      <AdminNavbar />
      <main className="admin-page-surface min-h-screen bg-[#f5f3ee]">
        {children}
      </main>
      <style>{`
        .admin-page-surface > * {
          background: #f5f3ee !important;
        }
      `}</style>
    </div>
  );
}