import React, { useState } from 'react';
import {
  Box, Drawer, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Tooltip
} from '@mui/material';
import {
  Dashboard, AccountCircle, MonetizationOn, AssignmentTurnedIn,
  AddCircle, ChevronLeft, ChevronRight
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';

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
  const toggleDrawer = () => setCollapsed(prev => !prev);

  const location = useLocation(); // To highlight active link

  return (
    <Box display="flex">
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: collapsed ? 60 : drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: collapsed ? 60 : drawerWidth,
            boxSizing: 'border-box',
            backgroundColor: '#fff'
          }
        }}
      >
        <Box display="flex" justifyContent="center" mt={2}>
          <IconButton onClick={toggleDrawer}>
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </IconButton>
        </Box>

        <List>
          {menuItems.map(item => (
            <Tooltip title={collapsed ? item.label : ''} placement="right" key={item.route}>
              <ListItem
                button
                component={Link}
                to={item.route}
                selected={location.pathname === item.route}
              >
                <ListItemIcon sx={{ justifyContent: 'center' }}>{item.icon}</ListItemIcon>
                {!collapsed && <ListItemText primary={item.label} />}
              </ListItem>
            </Tooltip>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box component="main" sx={{ flexGrow: 1, p: 3, minHeight: '100vh' }}>
        {children}
      </Box>
    </Box>
  );
}

export default DashboardLayout;
