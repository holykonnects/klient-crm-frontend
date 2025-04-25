// DashboardLayout.js
import React, { useState, useEffect } from 'react';
import {
  Box, Drawer, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Tooltip, Typography
} from '@mui/material';
import {
  ChevronLeft, ChevronRight,
  Dashboard, AccountCircle, MonetizationOn, AssignmentTurnedIn, AddCircle
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';

const drawerWidth = 240;
const cornflowerBlue = '#6495ED';
const sidebarBackground = '#fdfdfd'; // Slight white

const menuItems = [
  { label: 'Leads', icon: <Dashboard />, route: '/view-leads' },
  { label: 'Accounts', icon: <AccountCircle />, route: '/view-accounts' },
  { label: 'Deals', icon: <MonetizationOn />, route: '/view-deals' },
  { label: 'Orders', icon: <AssignmentTurnedIn />, route: '/view-orders' },
  { label: 'Add Lead', icon: <AddCircle />, route: '/add-lead' }
];

function DashboardLayout({ children }) {
  const [open, setOpen] = useState(true);
  const location = useLocation();

  // 🔁 Reset drawer to open state on route change
  useEffect(() => {
    setOpen(true);
  }, [location.pathname]);

  const toggleDrawer = () => setOpen(prev => !prev);

  return (
    <Box display="flex">
      <Drawer
        variant="permanent"
        open={open}
        sx={{
          width: open ? drawerWidth : 60,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: open ? drawerWidth : 60,
            backgroundColor: sidebarBackground,
            transition: 'width 0.3s ease',
            overflowX: 'hidden',
            boxShadow: '2px 0 6px rgba(0,0,0,0.05)',
            position: 'relative',
            zIndex: 1200 
          }
        }}
      >
        {/* Toggle Button */}
        <Box display="flex" justifyContent="center" alignItems="center" height={64}>
          <IconButton onClick={toggleDrawer}>
            {open ? <ChevronLeft /> : <ChevronRight />}
          </IconButton>
        </Box>

        {/* Menu Items */}
        <List>
          {menuItems.map(({ label, icon, route }) => (
            <Tooltip key={label} title={open ? '' : label} placement="right">
              <ListItem button component={Link} to={route}>
                <ListItemIcon sx={{ color: cornflowerBlue }}>{icon}</ListItemIcon>
                {open && (
                  <ListItemText
                    primary={<Typography sx={{ color: cornflowerBlue, fontWeight: 600 }}>{label}</Typography>}
                  />
                )}
              </ListItem>
            </Tooltip>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box flexGrow={1} p={3}>
        {children}
      </Box>
    </Box>
  );
}

export default DashboardLayout;
