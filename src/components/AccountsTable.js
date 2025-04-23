import React, { useEffect, useState } from 'react';

function AccountsTable() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbw9lmKBaT-yE_zfzA1S6eFu3YvK86Vi0bBgD7y_a1btvrsY1-H4FRI4OQBYLNuGKh9S/exec')
      .then(response => response.json())
      .then(data => {
        setAccounts(data);
        setLoading(false);
      });
  }, []);

  const sortedAccounts = [...accounts].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredAccounts = sortedAccounts
    .filter(acc =>
      ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead Status', 'Lead ID'].some(key =>
        String(acc[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .filter(acc =>
      (!filterStage || acc['Lead Status'] === filterStage) &&
      (!filterType || acc['Type'] === filterType) &&
      (!filterLeadSource || acc['Lead Source'] === filterLeadSource) &&
      (!filterOwner || acc['Lead Owner'] === filterOwner)
    );

  const requestSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const uniqueStages = [...new Set(accounts.map(d => d['Lead Status']).filter(Boolean))];
  const uniqueTypes = [...new Set(accounts.map(d => d['Type']).filter(Boolean))];
  const uniqueSources = [...new Set(accounts.map(d => d['Lead Source']).filter(Boolean))];
  const uniqueOwners = [...new Set(accounts.map(d => d['Lead Owner']).filter(Boolean))];

  if (loading) return <p>Loading accounts...</p>;
  if (!accounts.length) return <p>No accounts available.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Accounts Records</h2>

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
          placeholder="Search by Name, Company, Mobile..."
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

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            {Object.keys(accounts[0]).map(header => (
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
          {filteredAccounts.map((acc, index) => (
            <tr key={index}>
              {Object.values(acc).map((value, i) => (
                <td key={i}>{value}</td>
              ))}
              <td>
                <a href={acc['Prefilled Link'] || '#'} target="_blank" rel="noopener noreferrer">
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

export default AccountsTable;
