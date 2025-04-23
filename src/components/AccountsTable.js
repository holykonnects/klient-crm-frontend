import React, { useEffect, useState } from 'react';

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbzA0HwP6EMOlD04NcDXYbK0I2mRGN7G3rTzAjKTuYwoU6NL-RaMEtI8DRv0S9eELK7WbQ/exec') // Replace with your correct Apps Script URL
      .then(response => response.json())
      .then(data => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading accounts...</p>;
  if (!accounts.length) return <p>No accounts available.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Accounts Records</h2>

      {/* 🔍 Search Input */}
      <input
        type="text"
        placeholder="Search by Company, City, Mobile, Lead Owner..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem', width: '300px' }}
      />

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            {Object.keys(accounts[0]).map(header => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts
            .filter(account =>
              ['Company', 'City', 'Mobile Number', 'Lead Owner', 'Lead ID'].some(key =>
                String(account[key] || '')
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              )
            )
            .map((account, index) => (
              <tr key={index}>
                {Object.values(account).map((value, i) => (
                  <td key={i}>{value}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default AccountsTable;
