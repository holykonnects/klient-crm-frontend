import React, { useState, useEffect } from 'react';
import {
  Box, Drawer, List, ListItem, ListItemIcon, ListItemText,
  IconButton, Tooltip, Typography, Button
} from '@mui/material';
import {
  ChevronLeft, ChevronRight,
  PersonAddAlt, Dashboard, AccountCircle, MonetizationOn, AssignmentTurnedIn, Assignment, Groups, EditCalendar, AddCircle,Logout as LogoutIcon
} from '@mui/icons-material';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const drawerWidth = 240;
const cornflowerBlue = '#6495ED';
const sidebarBackground = '#fdfdfd'; // Slight white

function DashboardLayout({ children }) {
  const [open, setOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    setOpen(true);
  }, [location.pathname]);

  const toggleDrawer = () => setOpen(prev => !prev);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const menuItems = [
    { label: 'Leads', icon: <PersonAddAlt />, route: '/view-leads', access: 'Lead' },
    { label: 'Accounts', icon: <AccountCircle />, route: '/view-accounts', access: 'Account' },
    { label: 'Deals', icon: <MonetizationOn />, route: '/view-deals', access: 'Deal' },
    { label: 'Orders', icon: <AssignmentTurnedIn />, route: '/view-orders', access: 'Order' },
    { label: 'Add Lead', icon: <AddCircle />, route: '/add-lead', access: 'Add Lead' },
    { label: 'Tenders', icon: <Groups />, route: '/tender', access: 'Tender' },
    { label: 'Add Tender', icon: <Assignment />, route: '/manage-tender', access: 'Manage Tender' },
    { label: 'View Calendar', icon: <EditCalendar />, route: '/calendar', access: 'Calendar' },
  ];

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
            zIndex: 1200,
            display: 'flex',
            flexDirection: 'column'
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
        <List sx={{ flexGrow: 1 }}>
          {menuItems.filter(item => user?.pageAccess?.includes(item.access)).map(({ label, icon, route }) => (
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

        {/* Logout Button at Bottom */}
        <Box sx={{ position: 'absolute', bottom: 0, width: '100%' }}>
          <List>
            <Tooltip title="Logout" placement="right">
              <ListItem button onClick={logout}>
                <ListItemIcon sx={{ color: 'red' }}>
                  <LogoutIcon />
                </ListItemIcon>
                {open && (
                  <ListItemText
                    primary={<Typography sx={{ color: 'red', fontWeight: 600 }}>Logout</Typography>}
                  />
                )}
              </ListItem>
            </Tooltip>
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box flexGrow={1} p={3}>
        {children}
      </Box>
    </Box>
  );
}

export default DashboardLayout;
