import React, { useEffect, useState } from 'react';

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwJvHUNBaOAWf9oPagM1_SOZ4q4n4cV06a1d03C2zv9EBJVDqyK9zSRklZLu2_TZRNd/exec')
      .then(response => response.json())
      .then(data => {
        setDeals(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading deals...</p>;
  if (!deals.length) return <p>No deals available.</p>;

  return (
  <div style={{ padding: '2rem' }}>
    <h2>Deals Records</h2>

    {/* 🔍 Search Input */}
    <input
      type="text"
      placeholder="Search by Deal Name, Company, Mobile..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      style={{ marginBottom: '1rem', padding: '0.5rem', width: '300px' }}
    />

    <table border="1" cellPadding="10">
      <thead>
        <tr>
          {Object.keys(deals[0]).map(header => (
            <th key={header}>{header}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {deals
          .filter(deal =>
            ['Deal Name', 'Company', 'Mobile Number', 'Stage', 'Account ID'].some(key =>
              String(deal[key] || '')
                .toLowerCase()
                .includes(searchTerm.toLowerCase())
            )
          )
          .map((deal, index) => (
            <tr key={index}>
              {Object.values(deal).map((value, i) => (
                <td key={i}>{value}</td>
              ))}
            </tr>
          ))}
      </tbody>
    </table>
  </div>
);

export default DealsTable;
