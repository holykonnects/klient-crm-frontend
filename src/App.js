import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import LeadsTable from './components/LeadsTable';
import AccountsTable from './components/AccountsTable';
import DealsTable from './components/DealsTable';
import OrdersTable from './components/OrdersTable';
import LeadForm from './components/LeadForm';
import Dashboard from './components/Dashboard';
import TenderTable from './components/TenderTable';           // ✅ NEW
import ManageTender from './components/ManageTender';         // ✅ NEW
import ProtectedPage from './components/ProtectedPage';       // ✅ Correct wrapper
import { AuthProvider, useAuth } from './components/AuthContext';
import CalendarView from './components/CalendarView';


const AppRoutes = () => {
  const { user } = useAuth();

  return user ? (
    <DashboardLayout>
      <Routes>
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="view-leads" element={<LeadsTable />} />
        <Route path="view-accounts" element={<AccountsTable />} />
        <Route path="view-deals" element={<DealsTable />} />
        <Route path="view-orders" element={<OrdersTable />} />
        <Route path="add-lead" element={<LeadForm />} />
        <Route path="/calendar" element={<CalendarView />} />

        {/* ✅ NEW Tender routes with access control */}
        <Route
          path="tender"
          element={
            <ProtectedPage pageKey="Tender">
              <TenderTable />
            </ProtectedPage>
          }
        />
        <Route
          path="manage-tender"
          element={
            <ProtectedPage pageKey="Manage Tender">
              <ManageTender />
            </ProtectedPage>
          }
        />
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
