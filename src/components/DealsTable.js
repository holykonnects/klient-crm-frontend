import React, { useEffect, useState } from 'react';

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');

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
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredDeals = sortedDeals
    .filter(deal =>
      ['Deal Name', 'Company', 'Mobile Number', 'Stage', 'Account ID'].some(key =>
        String(deal[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .filter(deal =>
      (!filterStage || deal['Stage'] === filterStage) &&
      (!filterType || deal['Type'] === filterType) &&
      (!filterLeadSource || deal['Lead Source'] === filterLeadSource) &&
      (!filterOwner || deal['Account Owner'] === filterOwner)
    );

  const requestSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const uniqueStages = [...new Set(deals.map(d => d['Stage']).filter(Boolean))];
  const uniqueTypes = [...new Set(deals.map(d => d['Type']).filter(Boolean))];
  const uniqueSources = [...new Set(deals.map(d => d['Lead Source']).filter(Boolean))];
  const uniqueOwners = [...new Set(deals.map(d => d['Account Owner']).filter(Boolean))];

  if (loading) return <p>Loading deals...</p>;
  if (!deals.length) return <p>No deals available.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Deals Records</h2>

      {/* 🔍 + 🔽 Filters Row */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
        <input
          type="text"
          placeholder="Search by Deal Name, Company, Mobile..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ padding: '0.5rem', flex: '1' }}
        />

        <select value={filterStage} onChange={e => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>
          {uniqueStages.map(stage => (
            <option key={stage} value={stage}>{stage}</option>
          ))}
        </select>

        <select value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {uniqueTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>

        <select value={filterLeadSource} onChange={e => setFilterLeadSource(e.target.value)}>
          <option value="">All Sources</option>
          {uniqueSources.map(src => (
            <option key={src} value={src}>{src}</option>
          ))}
        </select>

        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}>
          <option value="">All Owners</option>
          {uniqueOwners.map(owner => (
            <option key={owner} value={owner}>{owner}</option>
          ))}
        </select>
      </div>

      {/* 📊 Table */}
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
                <a href={deal['Prefilled Link'] || '#'} target="_blank" rel="noopener noreferrer">
                  👁 View
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default DealsTable;
