import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, InputLabel, FormControl,
  IconButton, Dialog, DialogTitle, DialogContent, Grid, Checkbox,
  Button, Popover, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { createTheme, ThemeProvider } from '@mui/material/styles';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 9.5
  }
});

const selectorStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 8
};

function DealsTable() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterOwner, setFilterOwner] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: '', direction: 'asc' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [dealFormData, setDealFormData] = useState({});

  const dataUrl = 'https://script.google.com/macros/s/AKfycbwJvHUNBaOAWf9oPagM1_SOZ4q4n4cV06a1d03C2zv9EBJVDqyK9zSRklZLu2_TZRNd/exec';
  const submitUrl = 'https://script.google.com/macros/s/AKfycbxZ87qfE6u-2jT8xgSlYJu5dG6WduY0lG4LmlXSOk2EGkWBH4CbZIwEJxEHI-Bmduoh/exec';

  useEffect(() => {
    fetch(dataUrl)
      .then(res => res.json())
      .then(data => {
        setDeals(data);
        setVisibleColumns(data.length ? Object.keys(data[0]) : []);
        setLoading(false);
      });
  }, []);

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, direction });
  };

  const sortedDeals = [...deals].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key] || '';
    const bVal = b[sortConfig.key] || '';
    return sortConfig.direction === 'asc'
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal));
  });

  const filteredDeals = sortedDeals.filter(deal =>
    ['Deal Name', 'Company', 'Mobile Number', 'Stage', 'Account ID'].some(key =>
      (deal[key] || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) &&
    (!filterStage || deal['Stage'] === filterStage) &&
    (!filterType || deal['Type'] === filterType) &&
    (!filterSource || deal['Lead Source'] === filterSource) &&
    (!filterOwner || deal['Account Owner'] === filterOwner)
  );

  const handleColumnToggle = (col) => {
    setVisibleColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleFieldChange = (e) => {
    const { name, value } = e.target;
    setDealFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditClick = (deal) => {
    setSelectedRow(deal);
    setDealFormData(deal);
  };

  const handleSubmitDeal = async () => {
    try {
      await fetch(submitUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dealFormData)
      });
      alert('✅ Deal updated successfully');
    } catch {
      alert('❌ Error updating deal');
    }
    setSelectedRow(null);
  };

  if (loading) return <Typography>Loading deals...</Typography>;

  return (
    <ThemeProvider theme={theme}>
      <Box padding={4}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
          <Typography variant="h5" fontWeight="bold">Deals Records</Typography>
        </Box>

        <Table>
          <TableHead>
            <TableRow style={{ backgroundColor: '#6495ED' }}>
              {visibleColumns.map(header => (
                <TableCell
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{ color: 'white', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  {header} {sortConfig.key === header ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </TableCell>
              ))}
              <TableCell style={{ color: 'white', fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredDeals.map((deal, index) => (
              <TableRow key={index}>
                {visibleColumns.map((col, i) => (
                  <TableCell key={i}>{deal[col]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => handleEditClick(deal)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
            Edit Deal
          </DialogTitle>
          <DialogContent dividers>
            {[{
              title: 'Deal Details',
              fields: ['Deal Name', 'Type', 'Deal Amount', 'Next Step', 'Product Required', 'Remarks', 'Stage']
            }, {
              title: 'Customer Details',
              fields: ['Timestamp', 'Account Owner', 'First Name', 'Last Name', 'Company', 'Mobile Number',
                'Email ID', 'Fax', 'Website', 'Lead Source', 'Lead Status', 'Industry',
                'Number of Employees', 'Annual Revenue', 'Social Media', 'Description']
            }, {
              title: 'Address Details',
              fields: ['Street', 'City', 'State', 'Country', 'PinCode', 'Additional Description', 'Account ID']
            }, {
              title: 'Customer Banking Details',
              fields: ['GST Number', 'Bank Account Number', 'IFSC Code', 'Bank Name', 'Bank Account Name', 'Banking Remarks']
            }, {
              title: 'Order Details',
              fields: ['Order ID', 'Order Amount', 'Order Product Description', 'Order Details', 'Order Delivery Details', 'Order Delivery Date', 'Order Remarks']
            }].map(section => (
              <Accordion key={section.title} defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ backgroundColor: '#f0f4ff', fontFamily: 'Montserrat, sans-serif', fontWeight: 'bold' }}
                >
                  <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                    {section.title}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {section.fields.map(field => (
                      <Grid item xs={6} key={field}>
                        <TextField
                          fullWidth
                          size="small"
                          name={field}
                          label={field}
                          value={dealFormData[field] || ''}
                          onChange={handleFieldChange}
                          InputProps={{ readOnly: field === 'Order ID' }}
                        />
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
            <Box mt={2} display="flex" justifyContent="flex-end">
              <Button variant="contained" sx={{ backgroundColor: '#6495ED' }} onClick={handleSubmitDeal}>
                Update Deal
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default DealsTable;
