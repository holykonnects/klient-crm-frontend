import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Box, Typography, CircularProgress } from '@mui/material';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';

const CalendarView = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" height="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ padding: 3, fontFamily: 'Montserrat, sans-serif' }}>
      <Typography variant="h6" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif' }}>
        Calendar Schedule
      </Typography>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        allDaySlot={false}
        height="auto"
        events={events}
        eventContent={(eventInfo) => (
          <Box>
            <strong>{eventInfo.event.title}</strong>
            <br />
            <span style={{ fontSize: '0.75rem' }}>{eventInfo.event.extendedProps.purpose}</span>
          </Box>
        )}
        eventClick={(info) => {
          alert(`Meeting with ${info.event.extendedProps.client}\nPurpose: ${info.event.extendedProps.purpose}`);
        }}
      />
    </Box>
  );
};

export default CalendarView;
