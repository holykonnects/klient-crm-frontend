import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import LeadsTable from './components/LeadsTable';
import AccountsTable from './components/AccountsTable';
import DealsTable from './components/DealsTable';
import OrdersTable from './components/OrdersTable';
import LeadForm from './components/LeadForm';
import Dashboard from './components/Dashboard';
import { AuthProvider } from './components/AuthContext';
import { useAuth } from './components/AuthContext'; // ✅ NEW: import useAuth hook
import ProtectedRoute from './components/ProtectedRoute';

const AppRoutes = () => {
  const { user } = useAuth(); // ✅ NEW: get user from useAuth

  return user ? (
    <DashboardLayout>
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="view-leads" element={<LeadsTable />} />
        <Route path="view-accounts" element={<AccountsTable />} />
        <Route path="view-deals" element={<DealsTable />} />
        <Route path="view-orders" element={<OrdersTable />} />
        <Route path="add-lead" element={<LeadForm />} />
      </Routes>
    </DashboardLayout>
  ) : (
    <Routes>
      <Route path="*" element={<LoginPage />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/*" element={<AppRoutes />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
