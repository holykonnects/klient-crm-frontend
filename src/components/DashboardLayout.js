// DashboardLayout.js
import React, { useState } from 'react';
import { Box, Drawer, List, ListItem, ListItemIcon, ListItemText, IconButton, Tooltip } from '@mui/material';
import { Dashboard, AccountCircle, MonetizationOn, AssignmentTurnedIn, AddCircle, Menu } from '@mui/icons-material';
import { Link } from 'react-router-dom';

const drawerWidth = 240;

const menuItems = [
  { label: 'Leads', icon: <Dashboard />, route: '/view-leads' },
  { label: 'Accounts', icon: <AccountCircle />, route: '/view-accounts' },
  { label: 'Deals', icon: <MonetizationOn />, route: '/view-deals' },
  { label: 'Orders', icon: <AssignmentTurnedIn />, route: '/view-orders' },
  { label: 'Add Lead', icon: <AddCircle />, route: '/add-lead' }
];

function DashboardLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <Box display="flex">
      <Drawer
        variant="permanent"
        sx={{
          width: collapsed ? 72 : drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: collapsed ? 72 : drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#f5f5f5'
          }
        }}
      >
        <Box display="flex" justifyContent="center" alignItems="center" mt={2}>
          <IconButton onClick={() => setCollapsed(!collapsed)}>
            <Menu />
          </IconButton>
        </Box>

        <List>
          {menuItems.map((item) => (
            <Link to={item.route} key={item.label} style={{ textDecoration: 'none', color: 'inherit' }}>
              <Tooltip title={collapsed ? item.label : ''} placement="right">
                <ListItem button>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  {!collapsed && <ListItemText primary={item.label} />}
                </ListItem>
              </Tooltip>
            </Link>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        {children}
      </Box>
    </Box>
  );
}

export default DashboardLayout;
