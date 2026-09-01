import React from "react";
import { Navigate, Routes, Route } from "react-router-dom";

/* STAFF PAGES */
import DashboardStaff from "../pages/DashboardStaff";
import Orders from "../pages/Orders";
import CustomCakes from "../pages/CustomCakes";
import Products from "../pages/Products";
import Ingredients from "../pages/Ingredients";
import LowStockAlerts from "../pages/LowStockAlerts";
import WasteTracking from "../pages/WasteTracking";
import OrderHistory from "../pages/OrderHistory";
import Reports from "../pages/Reports";

export default function StaffApp() {
  return (
    <Routes>
      <Route index            element={<DashboardStaff />} />
      <Route path="dashboard" element={<DashboardStaff />} />
      <Route path="orders"    element={<Orders />} />
      <Route path="orders/history" element={<OrderHistory />} />
      <Route path="custom-cakes" element={<CustomCakes />} />
      <Route path="products"  element={<Products />} />
      <Route path="ingredients" element={<Ingredients />} />
      <Route path="finished-pastries" element={<Navigate to="/staff/products" replace />} />
      <Route path="low-stock" element={<LowStockAlerts />} />
      <Route path="waste-tracking" element={<WasteTracking />} />
      <Route path="reports"   element={<Reports />} />
    </Routes>
  );
}
