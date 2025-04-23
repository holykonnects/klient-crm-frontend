import React, { useEffect, useState } from 'react';

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

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
      <table border="1" cellPadding="10">
        <thead>
          <tr>
            {Object.keys(deals[0]).map(header => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {deals.map((deal, index) => (
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
}

export default DealsTable;
