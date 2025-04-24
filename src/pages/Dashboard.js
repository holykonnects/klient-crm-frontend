import React from 'react';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: 'center', marginTop: '2rem' }}>
      <h2>Welcome, Rido Sports</h2>
      <p>Select an option below:</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <button onClick={() => navigate('/add-lead')}>Add Lead</button>
        <button onClick={() => navigate('/view-leads')}>View Leads</button>
        <button>Edit Leads</button>
        <button onClick={() => navigate('/view-accounts')}>View Accounts</button>
        <button>Edit Accounts</button>
        <button onClick={() => navigate('/view-deals')}>View Deals</button>
        <button>Edit Deals</button>
        <button onClick={() => navigate('/view-orders')}>View Orders</button>
        <button>Edit Orders</button>
      </div>
    </div>
  );
}

export default Dashboard;
