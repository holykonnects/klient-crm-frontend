import React, { useState } from 'react';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  getCallUrl,
  getWhatsAppUrl,
  copyMobileNumber,
  sanitizeMobileNumber
} from '../utils/contactActions';
import '@fontsource/montserrat';

const menuTextStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontSize: 12
};

const MobileActionMenu = ({
  mobile,
  label,
  whatsappMessage = '',
  showValue = true
}) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [copied, setCopied] = useState(false);

  const cleanMobile = sanitizeMobileNumber(mobile);
  const displayMobile = String(mobile || '').trim();
  const open = Boolean(anchorEl);

  if (!cleanMobile) return <span>—</span>;

  const handleOpen = (event) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
  };

  const handleClose = (event) => {
    if (event?.stopPropagation) event.stopPropagation();
    setAnchorEl(null);
  };

  const handleCall = (event) => {
    handleClose(event);
    const url = getCallUrl(mobile);
    if (url) window.open(url, '_self');
  };

  const handleWhatsApp = (event) => {
    handleClose(event);
    const url = getWhatsAppUrl(mobile, whatsappMessage);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopy = async (event) => {
    handleClose(event);
    try {
      const ok = await copyMobileNumber(mobile);
      if (ok) setCopied(true);
    } catch (error) {
      console.error('Unable to copy mobile number', error);
    }
  };

  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        fontFamily: 'Montserrat, sans-serif'
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <Box
        component="button"
        type="button"
        onClick={handleOpen}
        sx={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          color: '#1976d2',
          textDecoration: 'underline',
          cursor: 'pointer',
          fontFamily: 'Montserrat, sans-serif',
          fontSize: 'inherit',
          lineHeight: 'inherit'
        }}
        title={label || 'Contact actions'}
      >
        {showValue ? displayMobile : 'Contact'}
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={(event) => event.stopPropagation()}
        PaperProps={{
          sx: {
            borderRadius: 2,
            minWidth: 190,
            fontFamily: 'Montserrat, sans-serif'
          }
        }}
      >
        <MenuItem onClick={handleCall} sx={menuTextStyle}>
          <ListItemIcon>
            <PhoneIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Call" primaryTypographyProps={{ sx: menuTextStyle }} />
        </MenuItem>

        <MenuItem onClick={handleWhatsApp} sx={menuTextStyle}>
          <ListItemIcon>
            <WhatsAppIcon fontSize="small" sx={{ color: '#25D366' }} />
          </ListItemIcon>
          <ListItemText primary="WhatsApp Message" primaryTypographyProps={{ sx: menuTextStyle }} />
        </MenuItem>

        <MenuItem onClick={handleCopy} sx={menuTextStyle}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Copy Number" primaryTypographyProps={{ sx: menuTextStyle }} />
        </MenuItem>
      </Menu>

      <Snackbar
        open={copied}
        autoHideDuration={1800}
        onClose={() => setCopied(false)}
        message="Mobile number copied"
      />
    </Box>
  );
};

export default MobileActionMenu;
