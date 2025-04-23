import React from 'react';
import { useNavigate } from 'react-router-dom';

function Landing() {
  const navigate = useNavigate();

  return (
    <div style={{ textAlign: 'center', marginTop: '5rem' }}>
      <h1>Welcome to Klient Konnect CRM</h1>
      <p>Streamline your Leads, Accounts, Deals & Orders.</p>
      <button onClick={() => navigate('/dashboard')}>Login to CRM</button>
    </div>
  );
}

export default Landing;
