import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import LeadForm from './components/LeadForm';
import LeadsTable from './components/LeadsTable';
import AccountsTable from './components/AccountsTable';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/add-lead" element={<LeadForm />} />
        <Route path="/view-leads" element={<LeadsTable />} />
        <Route path="/view-accounts" elements={<AccountsTable />} />
      </Routes>
    </Router>
  );
}

export default App;
