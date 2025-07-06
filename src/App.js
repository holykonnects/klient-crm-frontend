import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './LoginPage';
import DashboardLayout from './components/DashboardLayout';
import LeadsTable from './components/LeadsTable';
import AccountsTable from './components/AccountsTable';
import DealsTable from './components/DealsTable';
import OrdersTable from './components/OrdersTable';
import LeadForm from './components/LeadForm';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <Router>
      <DashboardLayout>
        <Routes>
          <Route path="/view-leads" element={<LeadsTable />} />
          <Route path="/view-accounts" element={<AccountsTable />} />
          <Route path="/view-deals" element={<DealsTable />} />
          <Route path="/view-orders" element={<OrdersTable />} />
          <Route path="/add-lead" element={<LeadForm />} /> {/* ✅ FIXED */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<LoginPage />} />
          //<Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </DashboardLayout>
    </Router>
  );
}

export default App;
