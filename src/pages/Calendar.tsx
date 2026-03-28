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
  Trash2
} from 'lucide-react';
import { db, collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { CalendarEvent } from '../types';
import { format, isAfter, startOfDay } from 'date-fns';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';

const Calendar: React.FC = () => {
  const { user, googleAccessToken, connectGoogleCalendar } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const calendarRef = useRef<FullCalendar>(null);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newColor, setNewColor] = useState('#ea580c'); // Orange 600

  // AI Insights state
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsText, setInsightsText] = useState('');

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
          setGoogleEvents(data.items || []);
        }
      } catch (error) {
        console.error("Failed to fetch Google Calendar events", error);
      }
    };

    fetchGoogleEvents();
  }, [googleAccessToken]);

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim() || !newStart || !newEnd) return;

    const newEvent: Omit<CalendarEvent, 'id'> = {
      title: newTitle,
      startTime: Timestamp.fromDate(new Date(newStart)),
      endTime: Timestamp.fromDate(new Date(newEnd)),
      color: newColor,
      userId: user.uid,
    };

    try {
      await addDoc(collection(db, 'calendar_events'), newEvent);
      setIsAddModalOpen(false);
      setNewTitle('');
      setNewStart('');
      setNewEnd('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'calendar_events');
    }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      await deleteDoc(doc(db, 'calendar_events', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `calendar_events/${id}`);
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
    ...googleEvents.map(event => ({
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
        htmlLink: event.htmlLink
      }
    }))
  ];

  const upcomingEvents = calendarEvents
    .filter(e => isAfter(new Date(e.start), startOfDay(new Date())))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);

  const handleGetInsights = async () => {
    if (!process.env.GEMINI_API_KEY) {
      alert("Gemini API key is not configured.");
      return;
    }
    
    setIsInsightsModalOpen(true);
    setInsightsLoading(true);
    setInsightsText('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
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
    } catch (error) {
      console.error("AI Insights Error:", error);
      setInsightsText("Failed to generate insights. Please try again later.");
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
        <div className="flex items-center gap-3">
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

      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
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
          `}</style>
          
          <div className="flex-1 min-h-[500px]">
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
              height="100%"
              editable={true}
              selectable={true}
              selectMirror={true}
              dayMaxEvents={true}
              eventClick={(info) => {
                setSelectedEvent(info.event.extendedProps as CalendarEvent);
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
            </div>

            <div className="flex gap-4">
              {selectedEvent.isGoogle ? (
                <a 
                  href={selectedEvent.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-primary-container/30 hover:bg-primary-container/50 text-primary py-4 rounded-2xl font-black transition-all"
                >
                  <CalendarIcon size={20} />
                  View in Google Calendar
                </a>
              ) : (
                <button 
                  onClick={() => {
                    handleDeleteEvent(selectedEvent.id);
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
                  <Markdown className="markdown-body text-sm">{insightsText}</Markdown>
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
