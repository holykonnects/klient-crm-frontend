    {/* Filters & Search */}
    <Box display="flex" gap={2} mb={2} flexWrap="wrap" alignItems="center">
      <TextField
        label="Search"
        variant="outlined"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        size="small"
        sx={{ minWidth: 200 }}
      />
      {['Lead Source', 'Lead Owner'].map(key => (
        <FormControl size="small" sx={{ minWidth: 160 }} key={key}>
          <InputLabel>{key}</InputLabel>
          <Select
            value={key === 'Lead Source' ? filterSource : filterOwner}
            label={key}
            onChange={e =>
              key === 'Lead Source' ? setFilterSource(e.target.value) : setFilterOwner(e.target.value)
            }
          >
            <MenuItem value="">All</MenuItem>
            {(validationData[key] || []).map(val => (
              <MenuItem key={val} value={val}>{val}</MenuItem>
            ))}
          </Select>
        </FormControl>
      ))}

      <IconButton onClick={e => setAnchorEl(e.currentTarget)}>
        <ViewColumnIcon />
      </IconButton>
      <Popover open={Boolean(anchorEl)} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
        <Box p={2} sx={selectorStyle}>
          <Button size="small" onClick={handleSelectAll}>Select All</Button>
          <Button size="small" onClick={handleDeselectAll}>Deselect All</Button>
          {Object.keys(accounts[0] || {}).map(col => (
            <Box key={col}>
              <Checkbox
                size="small"
                checked={visibleColumns.includes(col)}
                onChange={() => handleColumnToggle(col)}
              /> {col}
            </Box>
          ))}
        </Box>
      </Popover>
    </Box>

    {/* Table */}
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
        {filteredAccounts.map((acc, index) => (
          <TableRow key={index}>
            {visibleColumns.map((col, i) => (
              <TableCell key={i}>{acc[col]}</TableCell>
            ))}
            <TableCell>
              <IconButton onClick={() => handleEdit(acc)}>
                <EditIcon />
              </IconButton>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>

    {/* Edit Modal */}
    <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 'bold' }}>
        Edit Deal
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          {editRow &&
            Object.entries(formData).map(([key, value]) => (
              <Grid item xs={6} key={key}>
                <TextField
                  fullWidth
                  name={key}
                  label={key}
                  value={value}
                  onChange={handleChange}
                  size="small"
                />
              </Grid>
            ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSubmitDeal} variant="contained" sx={{ backgroundColor: '#6495ED' }}>
          Submit Deal
        </Button>
      </DialogActions>
    </Dialog>
  </Box>
</ThemeProvider>
);
}
