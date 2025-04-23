import React, { useEffect, useState } from 'react';

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbyh1_hms_eAcY40DZi6BXJAQe2tnD65nUTxtC6bX9S7s4TAh-Yh3psBZmhiPm_OAe6w/exec')
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
      <h2>Account Records</h2>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            {Object.keys(accounts[0]).map(header => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {accounts.map((account, index) => (
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
