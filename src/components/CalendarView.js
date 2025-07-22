import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, TextField, Grid } from '@mui/material';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';
import LoadingOverlay from './LoadingOverlay'; // Adjust path if needed
import './CalendarStyles.css'; // Custom styles for FullCalendar

const CalendarView = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState(null);
  const [formData, setFormData] = useState({ clientName: '', meetingDate: '', meetingTime: '', purpose: '' });

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

    fetchEvents();
  }, [user]);

  const handleDateSelect = (arg) => {
    const date = arg.startStr.split('T')[0];
    const time = arg.startStr.split('T')[1]?.slice(0, 5) || '10:00';
    setFormData(prev => ({ ...prev, meetingDate: date, meetingTime: time }));
    setOpenDialog(true);
  };

  const handleSubmit = () => {
    // Integrate with submitMeetingForm Apps Script endpoint here
    console.log('Submitting meeting:', formData);
    setOpenDialog(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (loading) return (<LoadingOverlay />);

  return (
    <Box sx={{ padding: 3, fontFamily: 'Montserrat, sans-serif' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" sx={{ fontWeight: 600, color: '#2f80ed' }}>
          Calendar Schedule
        </Typography>
        <Button variant="contained" sx={{ fontFamily: 'Montserrat', backgroundColor: '#2f80ed' }} onClick={() => setOpenDialog(true)}>
          + Create Meeting
        </Button>
      </Box>

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

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600 }}>Schedule Meeting</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Client Name" name="clientName" fullWidth value={formData.clientName} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={6} sm={3}>
              <TextField label="Date" name="meetingDate" type="date" fullWidth InputLabelProps={{ shrink: true }} value={formData.meetingDate} onChange={handleInputChange} />
            </Grid>
            <Grid item xs={6} sm={3}>
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
