import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import DashboardLayout from './components/DashboardLayout';
import LeadsTable from './components/LeadsTable';
import AccountsTable from './components/AccountsTable';
import DealsTable from './components/DealsTable';
import OrdersTable from './components/OrdersTable';
//import AddLeadForm from './components/AddLeadForm'; // Create this if not available
import LeadForm from './components/LeadForm';
import Dashboard from './components/Dashboard';
import { Navigate } from 'react-router-dom'; // ✅ Ensure this is imported at the top

function App() {
  return (
    <Router>
      <DashboardLayout>
        <Routes>
          <Route path="/view-leads" element={<LeadsTable />} />
          <Route path="/view-accounts" element={<AccountsTable />} />
          <Route path="/view-deals" element={<DealsTable />} />
          <Route path="/view-orders" element={<OrdersTable />} />
          <Route path="/add-lead" element={<DashboardLayout><LeadForm /></DashboardLayout>} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/" element={<Navigate to="/dashboard" />} />
          </Routes>
      </DashboardLayout>
    </Router>
  );
}

export default App;
