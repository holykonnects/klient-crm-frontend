import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Snackbar,
  Tooltip
} from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import MoreVertIcon from '@mui/icons-material/MoreVert';
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
  showValue = true,
  compact = true
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
        gap: compact ? 0.25 : 0.75,
        fontFamily: 'Montserrat, sans-serif'
      }}
      onClick={(event) => event.stopPropagation()}
    >
      {showValue && (
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
            fontSize: 'inherit'
          }}
          title={label || 'Contact actions'}
        >
          {displayMobile}
        </Box>
      )}

      <Tooltip title="Contact actions">
        <IconButton size="small" onClick={handleOpen} sx={{ padding: compact ? '2px' : '4px' }}>
          {showValue ? <MoreVertIcon sx={{ fontSize: 16 }} /> : <PhoneIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Tooltip>

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
