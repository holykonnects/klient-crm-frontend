// Updated CalendarView.js with clean flow for new lead and post-submission prompt
import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import {
  Box, Typography, Button, Dialog, DialogTitle, DialogContent,
  TextField, Grid, MenuItem, Select, InputLabel, FormControl, DialogActions, Link
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
  const [prefillUrl, setPrefillUrl] = useState('');
  const [entryType, setEntryType] = useState('');
  const [formData, setFormData] = useState({
    leadType: '',
    selectedEntry: '',
    newLeadName: '',
    meetingDate: '',
    meetingTime: '',
    purpose: '',
    entryValue: '',
    leadOwner: ''
  });
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    if (!user?.username) return;

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

    fetchEvents();
  }, [user]);

  useEffect(() => {
    if (!entryType) return;
    const action = entryType === 'Lead' ? 'getLeads' : entryType === 'Deal' ? 'getDeals' : 'getAccounts';

    const fetchEntries = async () => {
      try {
        const response = await fetch(
          `https://script.google.com/macros/s/AKfycbzCsp1ngGzlrbhNm17tqPeOgpVgPBrb5Pgoahxhy4rAZVLg5mFymYeioepLxBnqKOtPjw/exec?action=${action}&owner=${encodeURIComponent(user.username)}`
        );
        const data = await response.json();
        const formatted = [...new Set(data.entries)].map(e => ({ label: e, value: e }));
        setEntries(formatted);
      } catch (error) {
        console.error('Error fetching entries:', error);
      }
    };

    fetchEntries();
  }, [entryType]);

  const handleDateSelect = (arg) => {
    const date = arg.startStr.split('T')[0];
    const time = arg.startStr.split('T')[1]?.slice(0, 5) || '10:00';
    setFormData(prev => ({ ...prev, meetingDate: date, meetingTime: time, leadOwner: user.username }));
    setOpenDialog(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    sendMeetingData();
  };

  const sendMeetingData = async () => {
  const entryValue = entryType === 'Lead'
    ? (formData.leadType === 'Existing' ? formData.selectedEntry : formData.newLeadName)
    : formData.selectedEntry;

  const payload = {
    entryType,
    leadType: formData.leadType,
    entryValue,
    meetingDate: formData.meetingDate,
    meetingTime: formData.meetingTime,
    purpose: formData.purpose,
    leadOwner: formData.leadOwner
  };

  try {
    const res = await fetch("https://script.google.com/macros/s/AKfycbzCsp1ngGzlrbhNm17tqPeOgpVgPBrb5Pgoahxhy4rAZVLg5mFymYeioepLxBnqKOtPjw/exec", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`HTTP error! Status: ${res.status}`);
    }

    const result = await res.json();

    if (result.success) {
      alert("✅ Meeting submitted successfully!");

      // If it's a new lead and prefill link exists, open it
      if (formData.leadType === 'New' && result.prefillUrl) {
        window.open(result.prefillUrl, '_blank');
      }
    } else {
      alert("⚠️ Submission failed. " + (result.message || "Please try again."));
    }

  } catch (error) {
    console.error('❌ Error submitting meeting:', error);
    alert("❌ Submission failed. Please check console or try again.");
  } finally {
    // Always reset form regardless of outcome
    setOpenDialog(false);
    setFormData({
      leadType: '',
      selectedEntry: '',
      newLeadName: '',
      meetingDate: '',
      meetingTime: '',
      purpose: '',
      entryValue: '',
      leadOwner: ''
    });
    setEntryType('');
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
          select={handleDateSelect}
          allDaySlot={false}
          height="auto"
          headerToolbar={{ start: 'prev,next today', center: 'title', end: 'timeGridDay,timeGridWeek,dayGridMonth' }}
          dayCellClassNames={(arg) => ["montserrat-day-cell", arg.date.toDateString() === new Date().toDateString() ? "today-highlight" : ""]}
          events={events}
          eventContent={(eventInfo) => (
            <Box sx={{ fontFamily: 'Montserrat, sans-serif', fontSize: '0.75rem', padding: '4px' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.85rem' }}>{eventInfo.event.title}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#666' }}>{eventInfo.event.extendedProps.purpose}</Typography>
              <Typography sx={{ fontSize: '0.7rem', color: '#aaa' }}>by {eventInfo.event.extendedProps.owner}</Typography>
            </Box>
          )}
        />
      </Box>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Schedule Meeting</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Entry Type</InputLabel>
                <Select value={entryType} onChange={(e) => { setEntryType(e.target.value); setFormData(prev => ({ ...prev, leadType: '', selectedEntry: '', newLeadName: '' })); }}>
                  <MenuItem value="Lead">Lead</MenuItem>
                  <MenuItem value="Deal">Deal</MenuItem>
                  <MenuItem value="Account">Account</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {entryType === 'Lead' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Lead Type</InputLabel>
                  <Select name="leadType" value={formData.leadType} onChange={handleInputChange}>
                    <MenuItem value="Existing">Existing Lead</MenuItem>
                    <MenuItem value="New">New Lead</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {(entryType === 'Deal' || entryType === 'Account' || (entryType === 'Lead' && formData.leadType === 'Existing')) && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select {entryType}</InputLabel>
                  <Select name="selectedEntry" value={formData.selectedEntry} onChange={handleInputChange}>
                    {entries.map((entry, i) => (
                      <MenuItem key={i} value={entry.value}>{entry.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {entryType === 'Lead' && formData.leadType === 'New' && (
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

    </Box>
  );
};

export default CalendarView;
