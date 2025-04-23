import React, { useEffect, useState } from 'react';

function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterLeadSource, setFilterLeadSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec')
      .then(response => response.json())
      .then(data => {
        setLeads(data);
        setLoading(false);
      });
  }, []);

  const sortedLeads = [...leads].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredLeads = sortedLeads
    .filter(lead =>
      ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead Status', 'Lead ID'].some(key =>
        String(lead[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    )
    .filter(lead =>
      (!filterStage || lead['Lead Status'] === filterStage) &&
      (!filterType || lead['Type'] === filterType) &&
      (!filterLeadSource || lead['Lead Source'] === filterLeadSource) &&
      (!filterOwner || lead['Lead Owner'] === filterOwner)
    );

  const requestSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const uniqueStages = [...new Set(leads.map(d => d['Lead Status']).filter(Boolean))];
  const uniqueTypes = [...new Set(leads.map(d => d['Type']).filter(Boolean))];
  const uniqueSources = [...new Set(leads.map(d => d['Lead Source']).filter(Boolean))];
  const uniqueOwners = [...new Set(leads.map(d => d['Lead Owner']).filter(Boolean))];

  if (loading) return <p>Loading leads...</p>;
  if (!leads.length) return <p>No leads available.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Leads Records</h2>

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
            {Object.keys(leads[0]).map(header => (
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
          {filteredLeads.map((lead, index) => (
            <tr key={index}>
              {Object.values(lead).map((value, i) => (
                <td key={i}>{value}</td>
              ))}
              <td>
                <a href={lead['Prefilled Link'] || '#'} target="_blank" rel="noopener noreferrer">
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

export default LeadsTable;
