import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';

import Sidebar from './components/Sidebar';
import LeadsTable from './components/LeadsTable';
import AccountsTable from './components/AccountsTable';
import DealsTable from './components/DealsTable';
import Dashboard from './pages/Dashboard';
import AddLead from './pages/AddLead';

function Layout() {
  const navigate = useNavigate();

  return (
    <Box display="flex">
      <Sidebar onNavigate={(path) => navigate(`/${path}`)} />
      <Box flexGrow={1} padding={3}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/leads" element={<LeadsTable />} />
          <Route path="/accounts" element={<AccountsTable />} />
          <Route path="/deals" element={<DealsTable />} />
          <Route path="/add-lead" element={<AddLead />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <Router>
      <Layout />
    </Router>
  );
}

export default App;
