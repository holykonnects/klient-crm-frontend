import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  TextField, Grid, MenuItem, Select, InputLabel, FormControl, DialogActions
} from '@mui/material';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';
import LoadingOverlay from './LoadingOverlay';
import './CalendarStyles.css';

const CalendarView = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [formData, setFormData] = useState({
    leadType: '',
    selectedLead: '',
    newLeadName: '',
    meetingDate: '',
    meetingTime: '',
    purpose: ''
  });
  const [userLeads, setUserLeads] = useState([]);

  useEffect(() => {
    if (!user || !user.username) return;

    const fetchEvents = async () => {
      try {
        const response = await fetch(
          `https://script.google.com/macros/s/AKfycbzCsp1ngGzlrbhNm17tqPeOgpVgPBrb5Pgoahxhy4rAZVLg5mFymYeioepLxBnqKOtPjw/exec?action=getEvents&user=${encodeURIComponent(user.username)}`
        );
        const data = await response.json();
        setEvents(data);
      } catch (error) {
        console.error('Error fetching calendar events:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchLeads = async () => {
      try {
        const response = await fetch(
          `https://script.google.com/macros/s/AKfycbwJvHUNBaOAWf9oPagM1_SOZ4q4n4cV06a1d03C2zv9EBJVDqyK9zSRklZLu2_TZRNd/exec?action=read&type=lead`
        );
        const data = await response.json();
        const filtered = data.filter(entry => entry['Lead Owner'] === user.username);
        const leadNames = filtered.map(lead => lead['Company'] || lead['First Name'] || 'Unnamed Lead');
        setUserLeads(leadNames);
      } catch (error) {
        console.error('Error fetching leads:', error);
      }
    };

    fetchEvents();
    fetchLeads();
  }, [user]);

  const handleDateSelect = (arg) => {
    const date = arg.startStr.split('T')[0];
    const time = arg.startStr.split('T')[1]?.slice(0, 5) || '10:00';
    setFormData(prev => ({ ...prev, meetingDate: date, meetingTime: time }));
    setOpenDialog(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (formData.leadType === 'New') {
      setShowConfirmModal(true);
    } else {
      sendMeetingData();
    }
  };

  const sendMeetingData = async () => {
    const payload = {
      leadType: formData.leadType,
      leadName: formData.leadType === 'Existing' ? formData.selectedLead : formData.newLeadName,
      meetingDate: formData.meetingDate,
      meetingTime: formData.meetingTime,
      purpose: formData.purpose,
      leadOwner: user.username
    };

    try {
      await fetch("https://script.google.com/macros/s/AKfycbzCsp1ngGzlrbhNm17tqPeOgpVgPBrb5Pgoahxhy4rAZVLg5mFymYeioepLxBnqKOtPjw/exec", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "Content-Type": "application/json"
        }
      });
      setOpenDialog(false);
      setShowConfirmModal(false);
    } catch (error) {
      console.error('Error submitting meeting:', error);
    }
  };

  if (loading) return (<LoadingOverlay />);

  return (
    <Box sx={{ padding: 3, fontFamily: 'Montserrat, sans-serif' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Box display="flex" alignItems="center">
          <img src="/assets/kk-logo.png" alt="Klient Konnect Logo" style={{ height: 100, marginRight: 12 }} />
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#2f80ed' }}>
            Calendar Schedule
          </Typography>
        </Box>
        <Button variant="contained" sx={{ fontFamily: 'Montserrat', backgroundColor: '#2f80ed' }} onClick={() => setOpenDialog(true)}>
          + Create Meeting
        </Button>
      </Box>

      <Box sx={{ boxShadow: 2, borderRadius: 2, padding: 2, backgroundColor: '#fff' }}>
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          selectable={true}
          selectMirror={true}
          select={handleDateSelect}
          allDaySlot={false}
          height="auto"
          headerToolbar={{
            start: 'prev,next today',
            center: 'title',
            end: 'timeGridDay,timeGridWeek,dayGridMonth'
          }}
          dayCellClassNames={(arg) => {
            const classes = ['montserrat-day-cell'];
            if (arg.date.toDateString() === new Date().toDateString()) {
              classes.push('today-highlight');
            }
            return classes;
          }}
          events={events}
          eventContent={(eventInfo) => (
            <Box sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem', padding: '4px' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {eventInfo.event.title}
              </Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#666' }}>
                {eventInfo.event.extendedProps.purpose}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#aaa' }}>
                by {eventInfo.event.extendedProps.owner}
              </Typography>
            </Box>
          )}
          eventClick={(info) => {
            alert(`Meeting with ${info.event.extendedProps.client}\nPurpose: ${info.event.extendedProps.purpose}`);
          }}
          eventDidMount={(info) => {
            info.el.style.border = '1px solid #2f80ed';
            info.el.style.borderRadius = '6px';
            info.el.style.cursor = 'pointer';
            info.el.addEventListener('mouseenter', () => {
              info.el.style.backgroundColor = '#f0f4ff';
            });
            info.el.addEventListener('mouseleave', () => {
              info.el.style.backgroundColor = '';
            });
          }}
        />
      </Box>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Schedule Meeting</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Lead Type</InputLabel>
                <Select name="leadType" value={formData.leadType} onChange={handleInputChange}>
                  <MenuItem value="Existing">Existing Lead</MenuItem>
                  <MenuItem value="New">New Lead</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            {formData.leadType === 'Existing' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Lead</InputLabel>
                  <Select name="selectedLead" value={formData.selectedLead} onChange={handleInputChange}>
                    {userLeads.map((lead, index) => (
                      <MenuItem key={index} value={lead}>{lead}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}
            {formData.leadType === 'New' && (
              <Grid item xs={12}>
                <TextField label="New Lead Name" name="newLeadName" fullWidth value={formData.newLeadName} onChange={handleInputChange} />
              </Grid>
            )}
            <Grid item xs={6}>
              <TextField label="Date" name="meetingDate" type="date" fullWidth InputLabelProps={{ shrink: true }} value={formData.meetingDate} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={6}>
              <TextField label="Time" name="meetingTime" type="time" fullWidth InputLabelProps={{ shrink: true }} value={formData.meetingTime} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12}>
              <TextField label="Purpose / Remarks" name="purpose" fullWidth multiline minRows={2} value={formData.purpose} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={12} textAlign="right">
              <Button onClick={handleSubmit} variant="contained" sx={{ backgroundColor: '#2f80ed', fontFamily: 'Montserrat' }}>Submit</Button>
            </Grid>
          </Grid>
        </DialogContent>
      </Dialog>

      <Dialog open={showConfirmModal} onClose={() => setShowConfirmModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Confirm New Lead</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontFamily: 'Montserrat' }}>
            This meeting is associated with a new lead. Do you want to proceed and auto-fill the lead form after submission?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowConfirmModal(false)} color="secondary" sx={{ fontFamily: 'Montserrat' }}>Cancel</Button>
          <Button onClick={sendMeetingData} variant="contained" sx={{ backgroundColor: '#2f80ed', fontFamily: 'Montserrat' }}>Yes, Proceed</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CalendarView;
