import React, { useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Box, Typography } from '@mui/material';
import { useAuth } from './AuthContext';
import '@fontsource/montserrat';
import LoadingOverlay from './LoadingOverlay'; // Adjust path if needed
import './CalendarStyles.css'; // Custom styles for FullCalendar


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
    return (<LoadingOverlay />);
  }

  return (
    <Box sx={{ padding: 3, fontFamily: 'Montserrat, sans-serif' }}>
      <Typography variant="h6" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, color: '#2f80ed' }}>
        Calendar Schedule
      </Typography>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
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
  );
};

export default CalendarView;
