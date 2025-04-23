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
        <button>Edit Leads</button>
        <button>Edit Accounts</button>
        <button>Edit Deals</button>
        <button>Edit Orders</button>
      </div>
    </div>
  );
}

export default Dashboard;
