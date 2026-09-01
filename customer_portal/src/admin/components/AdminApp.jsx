import React from "react";
import { Routes, Route } from "react-router-dom";

import AdminLayout from "../layouts/AdminLayout";
import Dashboard from "../pages/Dashboard";
import Orders from "../pages/Orders";
import Products from "../pages/Products";
import Reports from "../pages/Reports";
import Inventory from "../pages/Inventory";
import CustomCakes from "../pages/CustomCakes";
import OrderHistory from "../pages/OrderHistory";
import LowStockAlerts from "../pages/LowStockAlerts";
import WasteTracking from "../pages/WasteTracking";
import PredictiveAnalytics from "../pages/PredictiveAnalytics";
import Promotions from "../pages/Promotions";
import UserManagement from "../pages/UserManagement";

const renderWithLayout = (element) => <AdminLayout>{element}</AdminLayout>;

export default function AdminApp() {
  return (
    <Routes>
      <Route index element={renderWithLayout(<Dashboard />)} />
      <Route path="dashboard" element={renderWithLayout(<Dashboard />)} />
      <Route path="orders" element={renderWithLayout(<Orders />)} />
      <Route path="orders/history" element={renderWithLayout(<OrderHistory />)} />
      <Route path="custom-cakes" element={renderWithLayout(<CustomCakes />)} />
      <Route path="products" element={renderWithLayout(<Products />)} />
      <Route path="reports" element={renderWithLayout(<Reports />)} />
      <Route path="inventory" element={renderWithLayout(<Inventory />)} />
      <Route path="ingredients" element={renderWithLayout(<Inventory />)} />
      <Route path="low-stock" element={renderWithLayout(<LowStockAlerts />)} />
      <Route path="waste-tracking" element={renderWithLayout(<WasteTracking />)} />
      <Route path="predictive-demand" element={renderWithLayout(<PredictiveAnalytics />)} />
      <Route path="promotions" element={renderWithLayout(<Promotions />)} />
      <Route path="users" element={renderWithLayout(<UserManagement />)} />
    </Routes>
  );
}
