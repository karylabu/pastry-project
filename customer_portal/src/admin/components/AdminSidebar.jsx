import { Link } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart2,
  ClipboardList,
} from "lucide-react";

export default function AdminSidebar() {
  return (
    <div className="w-64 min-h-screen bg-black text-white p-5">

      <h1 className="text-2xl font-bold text-gold mb-10">
        Admin Panel
      </h1>

      <div className="space-y-5">

        <Link
          to="/admin/dashboard"
          className="flex items-center gap-3 hover:text-gold"
        >
          <LayoutDashboard size={20} />
          Dashboard
        </Link>

        <Link
          to="/admin/products"
          className="flex items-center gap-3 hover:text-gold"
        >
          <Package size={20} />
          Products
        </Link>

        <Link
          to="/admin/orders"
          className="flex items-center gap-3 hover:text-gold"
        >
          <ShoppingCart size={20} />
          Orders
        </Link>

        <Link
          to="/admin/inventory"
          className="flex items-center gap-3 hover:text-gold"
        >
          <ClipboardList size={20} />
          Inventory
        </Link>

        <Link
          to="/admin/reports"
          className="flex items-center gap-3 hover:text-gold"
        >
          <BarChart2 size={20} />
          Reports
        </Link>

      </div>
    </div>
  );
}