import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EditIcon from '@mui/icons-material/Edit';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9
  }
});

function LeadsTable() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editValues, setEditValues] = useState({});

  const fetchUrl = 'https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec';
  const updateUrl = 'https://script.google.com/macros/s/AKfycbwCmyJEEbAy4h3SY630yJSaB8Odd2wL_nfAmxvbKKU0oC4jrdWwgHab-KUpPzGzKBaEUA/exec';

  useEffect(() => {
    fetch(fetchUrl)
      .then(response => response.json())
      .then(data => {
        setLeads(data);
        setLoading(false);
      });
  }, []);

  const handleEdit = (row) => {
    setEditRow(row);
    setEditValues({ ...row });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditValues(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async () => {
    try {
      const now = new Date();
      const updatedTime = now.toLocaleString('en-GB').replace(',', ''); // DD/MM/YYYY HH:MM:SS
      const updatedData = {
        ...editValues,
        'Lead Updated Time': updatedTime
      };

      await fetch(updateUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedData)
      });

      alert('✅ Lead updated successfully!');
      setEditRow(null);
    } catch (error) {
      console.error('❌ Error updating lead:', error);
      alert('❌ Update failed.');
    }
  };

  if (loading) return <Typography>Loading Leads...</Typography>;

  const headers = Object.keys(leads[0] || {});

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Typography variant="h5" fontWeight="bold" mb={2}>Leads Records</Typography>

        <TextField
          label="Search"
          variant="outlined"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          size="small"
          sx={{ mb: 2, minWidth: 300 }}
        />

        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {headers.map(header => (
                <TableCell key={header} style={{ color: 'white', fontWeight: 'bold' }}>{header}</TableCell>
              ))}
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {leads.filter(lead =>
              Object.values(lead).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
              )
            ).map((lead, index) => (
              <TableRow key={index}>
                {headers.map(header => (
                  <TableCell key={header}>{lead[header]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => setSelectedRow(lead)}><VisibilityIcon /></IconButton>
                  <IconButton onClick={() => handleEdit(lead)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* View Modal */}
        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Lead Details</DialogTitle>
          <DialogContent dividers>
            {selectedRow && Object.entries(selectedRow).map(([key, value]) => (
              <Typography key={key}><strong>{key}:</strong> {value}</Typography>
            ))}
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Lead</DialogTitle>
          <DialogContent dividers>
            <Grid container spacing={2}>
              {headers.map((key, idx) => (
                <Grid item xs={12} sm={6} key={idx}>
                  <TextField
                    fullWidth
                    label={key}
                    name={key}
                    value={editValues[key] || ''}
                    onChange={handleEditChange}
                    size="small"
                  />
                </Grid>
              ))}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditRow(null)}>Cancel</Button>
            <Button onClick={handleEditSubmit} variant="contained" sx={{ backgroundColor: '#6495ED' }}>
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default LeadsTable;
