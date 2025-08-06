import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Table, TableHead, TableRow, TableCell,
  TableBody, TextField, Select, MenuItem, FormControl,
  IconButton, Popover, Checkbox, Button, Grid, Dialog,
  DialogTitle, DialogContent, Accordion, AccordionSummary,
  AccordionDetails, InputLabel, FormControlLabel
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SearchIcon from '@mui/icons-material/Search';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import '@fontsource/montserrat';
import { useAuth } from './AuthContext';

const theme = createTheme({
  typography: {
    fontFamily: 'Montserrat, sans-serif',
    fontSize: 10.5
  }
});

const selectorStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 8
};

const inputStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: '0.9rem',
  width: '100%'
};

const TravelTable = () => {
  const { user } = useAuth();
  const [travelData, setTravelData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [search, setSearch] = useState('');
  const [columnAnchor, setColumnAnchor] = useState(null);
  const [visibleColumns, setVisibleColumns] = useState([]);
  const [filters, setFilters] = useState({});
  const [validationOptions, setValidationOptions] = useState({});
  const [openDialog, setOpenDialog] = useState(false);
  const [formData, setFormData] = useState({});
  const [isEdit, setIsEdit] = useState(false);

  const fetchData = async () => {
    const base = 'https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec';
    const res = await fetch(`${base}?action=getTravelData&owner=${encodeURIComponent(user.username)}`);
    const json = await res.json();
    setHeaders(json.headers);
    setTravelData(json.rows);
    setFilteredData(json.rows);
    setVisibleColumns(json.headers);
  };

  const fetchValidationOptions = async () => {
    const res = await fetch('https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec?action=getValidationOptions');
    const json = await res.json();
    setValidationOptions(json);
  };

  useEffect(() => {
    fetchData();
    fetchValidationOptions();
  }, []);

  const handleSearch = (e) => {
    const term = e.target.value.toLowerCase();
    setSearch(term);
    setFilteredData(travelData.filter(row =>
      Object.values(row).some(val => String(val).toLowerCase().includes(term))
    ));
  };

  const handleFilter = (field, value) => {
    const newFilters = { ...filters, [field]: value };
    setFilters(newFilters);
    let filtered = [...travelData];
    Object.entries(newFilters).forEach(([key, val]) => {
      if (val) filtered = filtered.filter(row => row[key] === val);
    });
    if (search) filtered = filtered.filter(row =>
      Object.values(row).some(val => String(val).toLowerCase().includes(search))
    );
    setFilteredData(filtered);
  };

  const openEdit = (row) => {
    setIsEdit(true);
    setFormData(row);
    setOpenDialog(true);
  };

  const openAdd = () => {
    setIsEdit(false);
    setFormData({ 'Requested By': user.username });
    setOpenDialog(true);
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch('https://script.google.com/macros/s/AKfycbwj9or-XtCwtbLkR3UiTadmXFtN8m0XEz6MdHJKylmyQbNDBYZMKGEiveFOJh2awn9R/exec', {
        method: 'POST',
        body: JSON.stringify(formData),
        headers: { 'Content-Type': 'application/json' }
      });
      const result = await res.json();
      if (result.success) {
        fetchData();
        setOpenDialog(false);
      } else {
        alert('Error submitting data');
      }
    } catch (err) {
      console.error('Submission error:', err);
      alert('Submission failed');
    }
  };

  const groupedSections = {
    'Traveler Info': ["Requested By", "Department", "Designation"],
    'Travel Details': ["Travel Type", "Travel Purpose", "Destination", "Start Date", "End Date", "Mode of Travel"],
    'Booking & Budget': ["Preferred Airline / Train / Service", "Accommodation Required", "Hotel Preference", "Expected Budget (₹)", "Final Amount Spent (₹)", "Supporting Documents (Link)"],
    'Approval & Status': ["Approval Status", "Approved By", "Travel Status", "Remarks / Justification", "Booking Confirmation Details", "Expense Settlement Status"]
  };

  const renderField = (label) => {
    const isDropdown = Object.keys(validationOptions).includes(label);
    return (
      <Grid item xs={12} sm={6} key={label}>
        {isDropdown ? (
          <FormControl fullWidth>
            <InputLabel>{label}</InputLabel>
            <Select
              value={formData[label] || ''}
              label={label}
              onChange={(e) => setFormData({ ...formData, [label]: e.target.value })}
            >
              {validationOptions[label].map(opt => <MenuItem key={opt} value={opt}>{opt}</MenuItem>)}
            </Select>
          </FormControl>
        ) : (
          <TextField
            label={label}
            value={formData[label] || ''}
            onChange={(e) => setFormData({ ...formData, [label]: e.target.value })}
            fullWidth
            sx={inputStyle}
          />
        )}
      </Grid>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <Box p={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Box display="flex" alignItems="center" gap={2}>
            <img src="/assets/kk-logo.png" alt="Klient Konnect" style={{ height: 100 }} />
            <Typography variant="h6" sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
              Travel Management
            </Typography>
          </Box>
          <Button variant="contained" onClick={openAdd}>Add Travel</Button>
        </Box>

        <Box display="flex" gap={2} mb={2} flexWrap="wrap">
          <TextField
            placeholder="Search..."
            value={search}
            onChange={handleSearch}
            size="small"
            InputProps={{ startAdornment: <SearchIcon /> }}
            sx={{ minWidth: 160 }}
          />
          {['Travel Status', 'Approval Status', 'Department', 'Travel Type'].map(field => (
            <FormControl key={field} sx={{ minWidth: 160 }} size="small">
              <InputLabel>{field}</InputLabel>
              <Select
                value={filters[field] || ''}
                onChange={(e) => handleFilter(field, e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {validationOptions[field]?.map(opt => (
                  <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                ))}
              </Select>
            </FormControl>
          ))}
          <IconButton onClick={(e) => setColumnAnchor(e.currentTarget)}>
            <ViewColumnIcon sx={selectorStyle} />
          </IconButton>
          <Popover
            open={Boolean(columnAnchor)}
            anchorEl={columnAnchor}
            onClose={() => setColumnAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          >
            <Box p={2}>
              {headers.map(header => (
                <FormControlLabel
                  key={header}
                  control={
                    <Checkbox
                      checked={visibleColumns.includes(header)}
                      onChange={() => {
                        const updated = visibleColumns.includes(header)
                          ? visibleColumns.filter(h => h !== header)
                          : [...visibleColumns, header];
                        setVisibleColumns(updated);
                      }}
                    />
                  }
                  label={<Typography sx={selectorStyle}>{header}</Typography>}
                />
              ))}
            </Box>
          </Popover>
        </Box>

        <Table>
          <TableHead>
            <TableRow>
              {headers.filter(h => visibleColumns.includes(h)).map(header => (
                <TableCell key={header}>{header}</TableCell>
              ))}
              <TableCell>Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredData.map((row, i) => (
              <TableRow key={i}>
                {headers.filter(h => visibleColumns.includes(h)).map(header => (
                  <TableCell key={header}>{row[header]}</TableCell>
                ))}
                <TableCell>
                  <IconButton onClick={() => openEdit(row)}><EditIcon /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="md" fullWidth>
          <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif' }}>
            {isEdit ? 'Edit Travel' : 'Add Travel'}
          </DialogTitle>
          <DialogContent>
            {Object.entries(groupedSections).map(([section, fields]) => (
              <Accordion key={section} defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: '#f0f4ff',
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 'bold'
                  }}
                >
                  <Typography sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>
                    {section}
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {fields.map(field => renderField(field))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
            <Box mt={2} textAlign="right">
              <Button variant="contained" onClick={handleSubmit}>
                {isEdit ? 'Update' : 'Submit'}
              </Button>
            </Box>
          </DialogContent>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
};

export default TravelTable;

