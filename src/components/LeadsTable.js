import React, { useEffect, useState } from 'react';

function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec')
      .then(response => response.json())
      .then(data => {
        setLeads(data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading leads...</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Lead Records</h2>
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            {Object.keys(leads[0]).map(header => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leads.map((lead, index) => (
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
