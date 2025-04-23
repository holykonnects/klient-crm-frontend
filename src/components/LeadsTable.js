import React, { useEffect, useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, TextField, Button, Dialog, DialogTitle, DialogContent, Typography
} from '@mui/material';

function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    fetch('https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec')
      .then(response => response.json())
      .then(data => {
        setLeads(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch leads:', err);
        setLoading(false);
      });
  }, []);

  const filteredLeads = leads.filter(lead =>
    ['First Name', 'Last Name', 'Company', 'Mobile Number'].some(key =>
      String(lead[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleView = (lead) => {
    setSelectedLead(lead);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedLead(null);
  };

  if (loading) return <p>Loading leads...</p>;
  if (!leads.length) return <p>No leads available.</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1rem' }}>
        {/* 🔷 Klient Konnect Logo */}
        <img src="/logo192.png" alt="Klient Konnect" style={{ height: 40, marginRight: '1rem' }} />
        <Typography variant="h5" component="div" sx={{ flexGrow: 1 }}>
          Leads Records
        </Typography>
        <TextField
          label="Search"
          variant="outlined"
          size="small"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ width: 300 }}
        />
      </div>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {Object.keys(leads[0]).map((key) => (
                <TableCell key={key}>{key}</TableCell>
              ))}
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLeads.map((lead, idx) => (
              <TableRow key={idx}>
                {Object.values(lead).map((val, i) => (
                  <TableCell key={i}>{val}</TableCell>
                ))}
                <TableCell>
                  <Button variant="outlined" size="small" onClick={() => handleView(lead)}>
                    👁 View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* 👁 View Modal */}
      <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="md" fullWidth>
        <DialogTitle>Lead Details</DialogTitle>
        <DialogContent>
          {selectedLead &&
            Object.entries(selectedLead).map(([key, value]) => (
              <Typography key={key}><strong>{key}:</strong> {value}</Typography>
            ))
          }
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default LeadsTable;
