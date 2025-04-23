import React, { useEffect, useState } from 'react';

function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec') // Update if your endpoint is different
      .then(response => response.json())
      .then(data => {
        setLeads(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading leads...</p>;
  if (!leads.length) return <p>No leads available.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Leads Records</h2>

      {/* 🔍 Search Input */}
      <input
        type="text"
        placeholder="Search by Name, Company, Mobile, Lead Status..."
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        style={{ marginBottom: '1rem', padding: '0.5rem', width: '300px' }}
      />

      <table border="1" cellPadding="10">
        <thead>
          <tr>
            {Object.keys(leads[0]).map(header => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads
            .filter(lead =>
              ['First Name', 'Last Name', 'Company', 'Mobile Number', 'Lead Status'].some(key =>
                String(lead[key] || '')
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase())
              )
            )
            .map((lead, index) => (
              <tr key={index}>
                {Object.values(lead).map((value, i) => (
                  <td key={i}>{value}</td>
                ))}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default LeadsTable;
