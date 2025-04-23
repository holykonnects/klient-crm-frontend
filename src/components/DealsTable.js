import React, { useEffect, useState } from 'react';

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwJvHUNBaOAWf9oPagM1_SOZ4q4n4cV06a1d03C2zv9EBJVDqyK9zSRklZLu2_TZRNd/exec')
      .then(response => response.json())
      .then(data => {
        setDeals(data);
        setLoading(false);
      });
  }, []);

  const sortedDeals = [...deals].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredDeals = sortedDeals.filter(deal =>
    ['Deal Name', 'Company', 'Mobile Number', 'Stage', 'Account ID'].some(key =>
      String(deal[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const requestSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (loading) return <p>Loading deals...</p>;
  if (!deals.length) return <p>No deals available.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Deals Records</h2>

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
              <th
                key={header}
                onClick={() => requestSort(header)}
                style={{ cursor: 'pointer' }}
              >
                {header} {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '🔼' : '🔽') : ''}
              </th>
            ))}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredDeals.map((deal, index) => (
            <tr key={index}>
              {Object.values(deal).map((value, i) => (
                <td key={i}>{value}</td>
              ))}
              <td>
                <a href={deal['Prefilled Link'] || '#'} target="_blank" rel="noopener noreferrer">👁 View</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DealsTable;
