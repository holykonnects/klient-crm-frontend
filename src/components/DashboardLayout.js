// DashboardLayout.js
import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Tooltip,
  Typography,
  Divider,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  Menu,
  ChevronLeft,
  ChevronRight,
  PersonAddAlt,
  Dashboard,
  AccountCircle,
  MonetizationOn,
  AssignmentTurnedIn,
  Assignment,
  Groups,
  EditCalendar,
  AddCircle,
  Logout as LogoutIcon,
  FlightTakeoff,
  CurrencyRupee,
  BusinessCenter,
  Construction,
  Email,
  ManageSearch,
  Inventory2,
  Description
} from '@mui/icons-material';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const drawerWidth = 240;
const cornflowerBlue = '#6495ED';
const sidebarBackground = '#fdfdfd';

function DashboardLayout({ children }) {
  const [open, setOpen] = useState(() => (
    typeof window === 'undefined' ? true : window.innerWidth >= 900
  ));
  const location = useLocation();
  const { user, logout } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    setOpen(!isMobile);
  }, [isMobile, location.pathname]);

  const toggleDrawer = () => setOpen(prev => !prev);
  const menuItems = [
    { label: 'Check Owner', icon: <ManageSearch />, route: '/existence-check', access: 'Existence Check' },
    { label: 'Dashboard', icon: <Dashboard />, route: '/dashboard', access: 'Dashboard' },
    { label: 'Add Lead', icon: <AddCircle />, route: '/add-lead', access: 'Add Lead' },
    { label: 'Leads', icon: <PersonAddAlt />, route: '/view-leads', access: 'Lead' },
    { label: 'Accounts', icon: <AccountCircle />, route: '/view-accounts', access: 'Account' },
    { label: 'Deals', icon: <MonetizationOn />, route: '/view-deals', access: 'Deal' },
    { label: 'Orders', icon: <AssignmentTurnedIn />, route: '/view-orders', access: 'Order' },
    { label: 'Tenders', icon: <Groups />, route: '/tender', access: 'Tender' },
    { label: 'Add Tender', icon: <Assignment />, route: '/manage-tender', access: 'Manage Tender' },
    { label: 'View Calendar', icon: <EditCalendar />, route: '/calendar', access: 'Calendar' },
    { label: 'Manage Travel', icon: <FlightTakeoff />, route: '/view-travel', access: 'Travel' },
    { label: 'Sales Tracker', icon: <CurrencyRupee />, route: '/sales-tracker', access: 'Sales Tracker' },
    { label: 'Nomenclature', icon: <Description />, route: '/nomenclature', access: 'Nomenclature' },
    { label: 'Build Quote', icon: <BusinessCenter />, route: '/quotation-builder', access: 'Quotation' },
    { label: 'Manage Project', icon: <Construction />, route: '/projects', access: 'Project' },
    { label: 'Costing', icon: <CurrencyRupee />, route: '/costing', access: 'Costing' },
    { label: 'Expense Requests', icon: <CurrencyRupee />, route: '/expense-requests', access: 'Expense Requests' },

    // ✅ NEW: Inventory
    { label: 'Inventory', icon: <Inventory2 />, route: '/inventory', access: 'Inventory' },

    // ✅ NEW: Stock Management
    { label: 'Stock Management', icon: <Inventory2 />, route: '/stock-management', access: 'Stock Management' },

    { label: 'Client Comms', icon: <Email />, route: '/email-dashboard', access: 'Email' }
  ];

  const drawerContent = (
    <>
      {/* Toggle Button */}
      <Box display="flex" justifyContent="center" alignItems="center" height={64}>
        <IconButton onClick={toggleDrawer}>
          {open ? <ChevronLeft /> : <ChevronRight />}
        </IconButton>
      </Box>

      {/* Menu + Logout (INLINE) */}
      <List sx={{ flexGrow: 1 }}>
        {menuItems
          .filter(item => item.show || user?.pageAccess?.includes(item.access))
          .map(({ label, icon, route }) => (
            <Tooltip key={label} title={open ? '' : label} placement="right">
              <ListItem button component={Link} to={route} onClick={() => isMobile && setOpen(false)}>
                <ListItemIcon sx={{ color: cornflowerBlue, minWidth: open ? 48 : 44 }}>
                  {icon}
                </ListItemIcon>
                {open && (
                  <ListItemText
                    primary={
                      <Typography
                        sx={{
                          color: cornflowerBlue,
                          fontWeight: 500,
                          fontFamily: 'Montserrat, sans-serif',
                          fontSize: 13
                        }}
                      >
                        {label}
                      </Typography>
                    }
                  />
                )}
              </ListItem>
            </Tooltip>
          ))}

        {/* TWO DIVIDERS BELOW LAST MENU ITEM */}
        <Divider sx={{ my: 1, borderColor: '#FFFFFF', borderBottomWidth: 2 }} />
        <Divider sx={{ my: 1, borderColor: '#FFFFFF', borderBottomWidth: 2 }} />

        {/* LOGOUT INLINE */}
        <Tooltip title="Logout" placement="right">
          <ListItem button onClick={logout}>
            <ListItemIcon sx={{ color: 'red', minWidth: open ? 48 : 44 }}>
              <LogoutIcon />
            </ListItemIcon>
            {open && (
              <ListItemText
                primary={
                  <Typography
                    sx={{
                      color: 'red',
                      fontWeight: 500,
                      fontFamily: 'Montserrat, sans-serif',
                      fontSize: 13
                    }}
                  >
                    Logout
                  </Typography>
                }
              />
            )}
          </ListItem>
        </Tooltip>
      </List>
      <Box sx={{ mt: 'auto', px: open ? 2 : 0.5, py: 2, textAlign: 'center', borderTop: '1px solid #e7edf5' }}>
        {open && <Typography sx={{ mb: 0.75, fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.8 }}>Empowered by</Typography>}
        <img src="/assets/kk-logo.png" alt="Empowered by Klient Konnect" style={{ width: open ? 72 : 42, height: 'auto', maxHeight: 48, objectFit: 'contain' }} />
      </Box>
    </>
  );

  return (
    <Box display="flex" sx={{ minHeight: '100vh', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      {isMobile && !open && (
        <IconButton
          onClick={toggleDrawer}
          aria-label="Open navigation"
          sx={{
            position: 'fixed',
            top: 10,
            left: 10,
            zIndex: 1300,
            width: 42,
            height: 42,
            backgroundColor: '#ffffff',
            color: cornflowerBlue,
            border: '1px solid #dbe6f5',
            boxShadow: '0 8px 20px rgba(23,32,51,0.14)',
            '&:hover': { backgroundColor: '#f8fbff' }
          }}
        >
          <Menu />
        </IconButton>
      )}

      <Drawer
        variant={isMobile ? "temporary" : "permanent"}
        open={open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isMobile ? 0 : open ? drawerWidth : 60,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: isMobile ? 'min(86vw, 320px)' : open ? drawerWidth : 60,
            maxWidth: '86vw',
            backgroundColor: sidebarBackground,
            transition: 'width 0.3s ease',
            overflowX: 'hidden',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '2px 0 6px rgba(0,0,0,0.05)',
            position: isMobile ? 'fixed' : 'relative',
            zIndex: 1200,
            fontFamily: 'Montserrat, sans-serif'
          }
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Main Content */}
      <Box
        flexGrow={1}
        className="crm-main-content"
        minWidth={0}
        sx={{
          overflowX: 'auto',
          p: { xs: 1.25, sm: 2, md: 3 },
          pt: { xs: 7, md: 3 },
          width: isMobile ? '100vw' : 'auto',
          maxWidth: '100vw'
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export default DashboardLayout;
