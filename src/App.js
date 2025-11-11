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
import TenderTable from './components/TenderTable';
import ManageTender from './components/ManageTender';
import ProtectedPage from './components/ProtectedPage';
import { AuthProvider, useAuth } from './components/AuthContext';
import CalendarView from './components/CalendarView';
import TravelTable from './components/TravelTable';
import SalesTrackerTable from './components/SalesTrackerTable';
import QuotationBuilder from './components/QuotationBuilder';
import ProjectTable from './components/ProjectTable';

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
        <Route path="sales-tracker" element={<SalesTrackerTable />} />
        <Route path="quotation-builder" element={<QuotationBuilder />} />
        <Route path="projects" element={<ProjectTable />} />
        <Route path="email-templates" element={<EmailTemplatesTable />} />
        <Route path="email-studio" element={<EmailTemplateStudio />} />
        
        {/* ✅ Travel route with access control */}
        <Route
          path="/view-travel"
          element={
            <ProtectedPage pageKey="Travel">
              <TravelTable />
            </ProtectedPage>
          }
        />

        {/* ✅ Tender routes with access control */}
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
