import React, { useState, useEffect, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { useAuth } from '../AuthContext';
import { 
  Plus, 
  X, 
  Calendar as CalendarIcon, 
  Clock, 
  MapPin, 
  ChevronLeft, 
  ChevronRight,
  MoreVertical,
  Trash2,
  Bell
} from 'lucide-react';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { CalendarEvent } from '../types';
import { format, isAfter, startOfDay, differenceInMinutes, subMinutes } from 'date-fns';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { toast } from 'sonner';

const Calendar: React.FC = () => {
  const { user, googleAccessToken, connectGoogleCalendar } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>(() => {
    const cached = localStorage.getItem('cachedGoogleEvents_full');
    return cached ? JSON.parse(cached) : [];
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newColor, setNewColor] = useState('#ea580c'); // Orange 600
  const [newReminderMin, setNewReminderMin] = useState<number | ''>('');

  // AI Insights state
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsText, setInsightsText] = useState('');

  // Notification logic
  useEffect(() => {
    if (!events.length) return;

    const checkReminders = () => {
      const now = new Date();
      events.forEach(event => {
        if (event.reminderMin && event.reminderMin > 0) {
          const startTime = event.startTime.toDate();
          const reminderTime = subMinutes(startTime, event.reminderMin);
          
          // Check if it's time to notify (within the last minute to avoid multiple triggers)
          const diff = differenceInMinutes(now, reminderTime);
          if (diff === 0 && isAfter(startTime, now)) {
            // Check if we already notified for this event recently (simple check using sessionStorage)
            const notifiedKey = `notified_${event.id}`;
            if (!sessionStorage.getItem(notifiedKey)) {
              toast(`Reminder: ${event.title}`, {
                description: `Starts in ${event.reminderMin} minutes at ${format(startTime, 'h:mm a')}`,
                icon: <Bell className="text-primary" size={20} />,
                duration: 10000,
              });
              
              // Also try browser notification if permitted
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`Reminder: ${event.title}`, {
                  body: `Starts in ${event.reminderMin} minutes at ${format(startTime, 'h:mm a')}`,
                  icon: '/favicon.ico' // Assuming a default favicon exists
                });
              }
              
              sessionStorage.setItem(notifiedKey, 'true');
            }
          }
        }
      });
    };

    // Request notification permission if not already granted/denied
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const intervalId = setInterval(checkReminders, 60000); // Check every minute
    checkReminders(); // Initial check

    return () => clearInterval(intervalId);
  }, [events]);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'calendar_events'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CalendarEvent)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'calendar_events');
    });

    return unsubscribe;
  }, [user]);

  useEffect(() => {
    const fetchGoogleEvents = async () => {
      if (!googleAccessToken) return;
      try {
        const timeMin = new Date();
        timeMin.setMonth(timeMin.getMonth() - 1); // Fetch from last month
        
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&maxResults=100&singleEvents=true&orderBy=startTime`, {
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          setGoogleEvents(items);
          localStorage.setItem('cachedGoogleEvents_full', JSON.stringify(items));
        } else if (res.status === 401) {
          console.warn("Google token expired. Using cached events.");
        }
      } catch (error) {
        console.error("Failed to fetch Google Calendar events", error);
      }
    };

    fetchGoogleEvents();
  }, [googleAccessToken]);

  // Sync back updates from Google to local events
  useEffect(() => {
    const syncBack = async () => {
      if (!googleEvents.length || !events.length) return;
      for (const gEvent of googleEvents) {
        const localEvent = events.find(e => e.googleEventId === gEvent.id);
        if (localEvent) {
          const gStart = new Date(gEvent.start?.dateTime || gEvent.start?.date).getTime();
          const gEnd = new Date(gEvent.end?.dateTime || gEvent.end?.date).getTime();
          const lStart = localEvent.startTime.toDate().getTime();
          const lEnd = localEvent.endTime.toDate().getTime();
          const gTitle = gEvent.summary || 'Untitled Event';
          
          if (gStart !== lStart || gEnd !== lEnd || gTitle !== localEvent.title) {
            try {
              await updateDoc(doc(db, 'calendar_events', localEvent.id), {
                title: gTitle,
                startTime: Timestamp.fromDate(new Date(gStart)),
                endTime: Timestamp.fromDate(new Date(gEnd))
              });
            } catch (error) {
              console.error("Failed to sync back from Google", error);
            }
          }
        }
      }
    };
    syncBack();
  }, [googleEvents, events]);

  useEffect(() => {
    const syncLocalEventsToGoogle = async () => {
      if (!googleAccessToken || !user || events.length === 0) return;
      
      const unsyncedEvents = events.filter(e => !e.googleEventId && !e.isGoogle);
      if (unsyncedEvents.length === 0) return;

      for (const event of unsyncedEvents) {
        try {
          const gEvent = {
            summary: event.title,
            start: { dateTime: event.startTime.toDate().toISOString() },
            end: { dateTime: event.endTime.toDate().toISOString() },
          };
          const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(gEvent)
          });
          if (createRes.ok) {
            const createdGEvent = await createRes.json();
            await updateDoc(doc(db, 'calendar_events', event.id), {
              googleEventId: createdGEvent.id,
              htmlLink: createdGEvent.htmlLink
            });
            // Also add to local googleEvents so it shows up immediately
            setGoogleEvents(prev => [...prev, createdGEvent]);
          }
        } catch (error) {
          console.error("Failed to sync event to Google Calendar", error);
        }
      }
    };

    syncLocalEventsToGoogle();
  }, [googleAccessToken, user, events]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim() || !newStart || !newEnd) return;

    const newEvent: Omit<CalendarEvent, 'id'> = {
      title: newTitle,
      startTime: Timestamp.fromDate(new Date(newStart)),
      endTime: Timestamp.fromDate(new Date(newEnd)),
      color: newColor,
      userId: user.uid,
      ...(newReminderMin !== '' ? { reminderMin: Number(newReminderMin) } : {})
    };

    try {
      let googleEventId = undefined;
      let htmlLink = undefined;

      if (googleAccessToken) {
        const gEvent = {
          summary: newTitle,
          start: { dateTime: new Date(newStart).toISOString() },
          end: { dateTime: new Date(newEnd).toISOString() },
        };
        const createRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(gEvent)
        });
        if (createRes.ok) {
          const createdGEvent = await createRes.json();
          googleEventId = createdGEvent.id;
          htmlLink = createdGEvent.htmlLink;
          
          // Add to local googleEvents so it shows up immediately without refetching
          setGoogleEvents(prev => [...prev, createdGEvent]);
        }
      }

      await addDoc(collection(db, 'calendar_events'), {
        ...newEvent,
        ...(googleEventId ? { googleEventId, htmlLink } : {})
      });
      
      setIsAddModalOpen(false);
      setNewTitle('');
      setNewStart('');
      setNewEnd('');
      setNewReminderMin('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'calendar_events');
    }
  };

  const handleDeleteEvent = async (id: string, isGoogle?: boolean, googleEventId?: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      if (isGoogle && googleAccessToken) {
        // Delete directly from Google Calendar
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${googleAccessToken}`
          }
        });
        if (res.status === 401) {
          alert('Your Google Calendar session has expired. Please click "Connect Google" to re-authenticate before deleting.');
          return;
        }
        setGoogleEvents(prev => prev.filter(e => e.id !== id));
      } else {
        // Delete from Firestore
        await deleteDoc(doc(db, 'calendar_events', id));
        
        // Delete from Google Calendar if linked
        if (googleEventId && googleAccessToken) {
          const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${googleAccessToken}`
            }
          });
          if (res.status === 401) {
            alert('Local event deleted. However, Google session expired so it may still appear on your Google Calendar.');
          } else {
            setGoogleEvents(prev => prev.filter(e => e.id !== googleEventId));
          }
        }
      }
      setSelectedEvent(null);
    } catch (error) {
      if (!isGoogle) {
        handleFirestoreError(error, OperationType.DELETE, `calendar_events/${id}`);
      } else {
        console.error("Failed to delete Google event", error);
      }
    }
  };

  const calendarEvents = [
    ...events.map(event => ({
      id: event.id,
      title: event.title,
      start: event.startTime.toDate(),
      end: event.endTime.toDate(),
      backgroundColor: event.color,
      borderColor: event.color,
      extendedProps: { ...event, isGoogle: false }
    })),
    ...googleEvents
      .filter(gEvent => !events.some(e => e.googleEventId === gEvent.id))
      .map(event => ({
      id: event.id,
      title: event.summary,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      backgroundColor: '#4285F4', // Google Blue
      borderColor: '#4285F4',
      extendedProps: { 
        title: event.summary,
        startTime: { toDate: () => new Date(event.start?.dateTime || event.start?.date) },
        endTime: { toDate: () => new Date(event.end?.dateTime || event.end?.date) },
        color: '#4285F4',
        isGoogle: true,
        googleEventId: event.id,
        htmlLink: event.htmlLink
      }
    }))
  ];

  const upcomingEvents = calendarEvents
    .filter(e => isAfter(new Date(e.start), startOfDay(new Date())))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);

  const handleGetInsights = async () => {
    setIsInsightsModalOpen(true);
    setInsightsLoading(true);
    setInsightsText('');

    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("Gemini API key is missing. Please add GEMINI_API_KEY to the Secrets panel in AI Studio.");
      }
      const ai = new GoogleGenAI({ apiKey });
      
      let dataSummary = "User's Upcoming Schedule:\n\n";
      upcomingEvents.forEach(event => {
        dataSummary += `- ${event.title} on ${format(new Date(event.start), 'MMM d, h:mm a')}\n`;
      });

      if (upcomingEvents.length === 0) {
        dataSummary += "No upcoming events scheduled.";
      }

      const prompt = `Analyze the following upcoming schedule and provide a short, friendly summary with 1-2 actionable tips for time management or preparation. Keep it concise.\n\n${dataSummary}`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setInsightsText(response.text || "No insights generated.");
    } catch (error: any) {
      console.error("AI Insights Error:", error);
      setInsightsText(`Failed to generate insights: ${error.message || 'Unknown error'}`);
    } finally {
      setInsightsLoading(false);
    }
  };

  return (
    <div className="space-y-8 pb-24 md:pb-0 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Calendar</h1>
          <p className="text-on-surface-variant">Plan your schedule and set reminders.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!googleAccessToken && (
            <button 
              onClick={connectGoogleCalendar}
              className="flex items-center justify-center gap-2 bg-surface-container-lowest border border-outline-variant/20 hover:bg-surface-container text-on-surface px-6 py-3 rounded-2xl font-black transition-all shadow-sm uppercase tracking-widest text-xs"
            >
              <CalendarIcon size={20} className="text-secondary" />
              Connect Google
            </button>
          )}
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-on-primary px-6 py-3 rounded-2xl font-black transition-all shadow-lg shadow-primary/20 uppercase tracking-widest text-xs"
          >
            <Plus size={20} />
            Add Event
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        <div className="flex-1 bg-surface-container-lowest p-6 rounded-[2.5rem] border border-outline-variant/20 shadow-sm overflow-hidden flex flex-col">
          <style>{`
            .fc { font-family: inherit; --fc-border-color: var(--outline-variant); --fc-today-bg-color: var(--primary-container); height: 100%; }
            .fc .fc-toolbar-title { font-size: 1.25rem; font-weight: 800; color: var(--on-surface); text-transform: uppercase; letter-spacing: -0.02em; }
            .fc .fc-button-primary { background-color: var(--surface-container-low); border-color: var(--outline-variant); color: var(--on-surface-variant); font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; padding: 0.6rem 1.2rem; border-radius: 0.75rem; }
            .fc .fc-button-primary:hover { background-color: var(--surface-container); border-color: var(--outline); color: var(--on-surface); }
            .fc .fc-button-primary:not(:disabled).fc-button-active { background-color: var(--primary); border-color: var(--primary); color: var(--on-primary); }
            .fc .fc-col-header-cell-cushion { padding: 1rem; color: var(--on-surface); font-weight: 800; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; }
            .fc .fc-daygrid-day-number { padding: 0.75rem; font-weight: 700; color: var(--on-surface); }
            .fc-theme-standard td, .fc-theme-standard th { border: 1px solid var(--outline-variant); }
            .fc .fc-event { border-radius: 0.5rem; padding: 4px 8px; font-size: 0.7rem; font-weight: 800; border: none; text-transform: uppercase; letter-spacing: 0.02em; }
            @media (max-width: 768px) {
              .fc .fc-toolbar { flex-direction: column; gap: 1rem; }
              .fc .fc-toolbar-title { font-size: 1.1rem; }
              .fc .fc-button-primary { padding: 0.4rem 0.8rem; font-size: 0.6rem; }
              .fc .fc-toolbar-chunk { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem; }
            }
          `}</style>
          
          <div className="flex-1">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
              }}
              events={calendarEvents}
              height="auto"
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              eventClick={(info) => {
                setSelectedEvent(info.event.extendedProps as CalendarEvent);
              }}
              eventDrop={async (info) => {
                const event = info.event.extendedProps as CalendarEvent;
                try {
                  if (event.isGoogle && event.googleEventId && googleAccessToken) {
                    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}`, {
                      method: 'PATCH',
                      headers: {
                        'Authorization': `Bearer ${googleAccessToken}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        start: { dateTime: info.event.start!.toISOString() },
                        end: { dateTime: (info.event.end || info.event.start!).toISOString() }
                      })
                    });
                    // Update local state to reflect change immediately
                    setGoogleEvents(prev => prev.map(e => e.id === event.googleEventId ? {
                      ...e,
                      start: { dateTime: info.event.start!.toISOString() },
                      end: { dateTime: (info.event.end || info.event.start!).toISOString() }
                    } : e));
                  } else if (!event.isGoogle) {
                    const newStart = Timestamp.fromDate(info.event.start!);
                    const newEnd = Timestamp.fromDate(info.event.end || info.event.start!);
                    await updateDoc(doc(db, 'calendar_events', event.id), {
                      startTime: newStart,
                      endTime: newEnd
                    });
                    if (event.googleEventId && googleAccessToken) {
                      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}`, {
                        method: 'PATCH',
                        headers: {
                          'Authorization': `Bearer ${googleAccessToken}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          start: { dateTime: info.event.start!.toISOString() },
                          end: { dateTime: (info.event.end || info.event.start!).toISOString() }
                        })
                      });
                      setGoogleEvents(prev => prev.map(e => e.id === event.googleEventId ? {
                        ...e,
                        start: { dateTime: info.event.start!.toISOString() },
                        end: { dateTime: (info.event.end || info.event.start!).toISOString() }
                      } : e));
                    }
                  }
                } catch (error) {
                  info.revert();
                  if (!event.isGoogle) {
                    handleFirestoreError(error, OperationType.UPDATE, `calendar_events/${event.id}`);
                  } else {
                    console.error("Failed to update Google event", error);
                  }
                }
              }}
              eventResize={async (info) => {
                const event = info.event.extendedProps as CalendarEvent;
                try {
                  if (event.isGoogle && event.googleEventId && googleAccessToken) {
                    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}`, {
                      method: 'PATCH',
                      headers: {
                        'Authorization': `Bearer ${googleAccessToken}`,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({
                        start: { dateTime: info.event.start!.toISOString() },
                        end: { dateTime: info.event.end!.toISOString() }
                      })
                    });
                    setGoogleEvents(prev => prev.map(e => e.id === event.googleEventId ? {
                      ...e,
                      start: { dateTime: info.event.start!.toISOString() },
                      end: { dateTime: info.event.end!.toISOString() }
                    } : e));
                  } else if (!event.isGoogle) {
                    const newStart = Timestamp.fromDate(info.event.start!);
                    const newEnd = Timestamp.fromDate(info.event.end!);
                    await updateDoc(doc(db, 'calendar_events', event.id), {
                      startTime: newStart,
                      endTime: newEnd
                    });
                    if (event.googleEventId && googleAccessToken) {
                      await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${event.googleEventId}`, {
                        method: 'PATCH',
                        headers: {
                          'Authorization': `Bearer ${googleAccessToken}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                          start: { dateTime: info.event.start!.toISOString() },
                          end: { dateTime: info.event.end!.toISOString() }
                        })
                      });
                      setGoogleEvents(prev => prev.map(e => e.id === event.googleEventId ? {
                        ...e,
                        start: { dateTime: info.event.start!.toISOString() },
                        end: { dateTime: info.event.end!.toISOString() }
                      } : e));
                    }
                  }
                } catch (error) {
                  info.revert();
                  if (!event.isGoogle) {
                    handleFirestoreError(error, OperationType.UPDATE, `calendar_events/${event.id}`);
                  } else {
                    console.error("Failed to update Google event", error);
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          <div className="bg-surface-container-lowest p-6 rounded-[2.5rem] border border-outline-variant/20 shadow-sm flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-black text-on-surface uppercase tracking-widest">Upcoming</h2>
              <button 
                onClick={handleGetInsights}
                className="p-2 bg-secondary-container text-on-secondary-container rounded-xl hover:bg-secondary-container/80 transition-colors"
                title="AI Schedule Insights"
              >
                <CalendarIcon size={18} />
              </button>
            </div>
            
            <div className="space-y-4 flex-1 overflow-y-auto pr-2 dark-scrollbar">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map(event => (
                  <div 
                    key={event.id} 
                    className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/10 cursor-pointer hover:bg-surface-container transition-colors"
                    onClick={() => setSelectedEvent(event.extendedProps as CalendarEvent)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.backgroundColor }} />
                      <h3 className="font-bold text-on-surface text-sm truncate">{event.title}</h3>
                    </div>
                    <p className="text-xs text-on-surface-variant font-medium flex items-center gap-1.5">
                      <Clock size={12} />
                      {format(new Date(event.start), 'MMM d, h:mm a')}
                    </p>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <p className="text-on-surface-variant text-sm">No upcoming events.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* View Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div 
                  className="w-4 h-12 rounded-full" 
                  style={{ backgroundColor: selectedEvent.color }}
                />
                <div>
                  <h2 className="text-2xl font-black text-on-surface">{selectedEvent.title}</h2>
                  <p className="text-on-surface-variant font-bold text-sm mt-1">
                    {format(selectedEvent.startTime.toDate(), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl">
                <Clock className="text-on-surface-variant" size={24} />
                <div>
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Time</p>
                  <p className="font-black text-on-surface">
                    {format(selectedEvent.startTime.toDate(), 'h:mm a')} - {format(selectedEvent.endTime.toDate(), 'h:mm a')}
                  </p>
                </div>
              </div>
              
              {selectedEvent.reminderMin && (
                <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-2xl">
                  <Bell className="text-on-surface-variant" size={24} />
                  <div>
                    <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Reminder</p>
                    <p className="font-black text-on-surface">
                      {selectedEvent.reminderMin} minutes before
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4">
              {selectedEvent.isGoogle ? (
                <div className="flex w-full gap-4">
                  <a 
                    href={selectedEvent.htmlLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-primary-container/30 hover:bg-primary-container/50 text-primary py-4 rounded-2xl font-black transition-all"
                  >
                    <CalendarIcon size={20} />
                    View in Google
                  </a>
                  <button 
                    onClick={() => {
                      handleDeleteEvent(selectedEvent.id, true, selectedEvent.googleEventId);
                      setSelectedEvent(null);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 bg-error-container hover:bg-error-container/80 text-on-error-container py-4 rounded-2xl font-black transition-all"
                  >
                    <Trash2 size={20} />
                    Delete
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => {
                    handleDeleteEvent(selectedEvent.id, false, selectedEvent.googleEventId);
                    setSelectedEvent(null);
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-error-container hover:bg-error-container/80 text-on-error-container py-4 rounded-2xl font-black transition-all"
                >
                  <Trash2 size={20} />
                  Delete Event
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-on-surface">New Event</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Event Title</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CalendarIcon className="text-on-surface-variant" size={20} />
                  </div>
                  <input 
                    autoFocus
                    type="text" 
                    required
                    placeholder="What's happening?" 
                    className="w-full pl-12 pr-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-lg font-bold text-on-surface placeholder:text-on-surface-variant"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Start Time</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Clock className="text-on-surface-variant" size={16} />
                    </div>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full pl-10 pr-4 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-on-surface"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">End Time</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Clock className="text-on-surface-variant" size={16} />
                    </div>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full pl-10 pr-4 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-sm text-on-surface"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Reminder (Minutes before)</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Bell className="text-on-surface-variant" size={20} />
                  </div>
                  <input 
                    type="number" 
                    min="0"
                    placeholder="e.g., 15" 
                    className="w-full pl-12 pr-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-lg font-bold text-on-surface placeholder:text-on-surface-variant"
                    value={newReminderMin}
                    onChange={(e) => setNewReminderMin(e.target.value === '' ? '' : Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Label Color</label>
                <div className="flex gap-3">
                  {['#ea580c', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={`w-10 h-10 rounded-full transition-all ${newColor === color ? 'ring-4 ring-outline-variant scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-primary hover:opacity-90 text-on-primary py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all mt-4 uppercase tracking-widest"
              >
                Create Event
              </button>
            </form>
          </div>
        </div>
      )}
      {/* AI Insights Modal */}
      {isInsightsModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                <CalendarIcon className="text-primary" /> Schedule Insights
              </h2>
              <button onClick={() => setIsInsightsModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="min-h-[150px] max-h-[400px] overflow-y-auto pr-2 dark-scrollbar">
              {insightsLoading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4 py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-on-surface-variant font-medium animate-pulse">Analyzing your schedule...</p>
                </div>
              ) : (
                <div className="text-on-surface leading-relaxed">
                  <div className="markdown-body text-sm">
                    <Markdown>{insightsText}</Markdown>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={() => setIsInsightsModalOpen(false)}
              className="w-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface py-4 rounded-2xl font-black text-lg transition-all mt-6 uppercase tracking-widest"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
