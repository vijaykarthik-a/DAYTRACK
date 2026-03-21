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
import { format } from 'date-fns';

const Calendar: React.FC = () => {
  const { user, googleAccessToken } = useAuth();
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

  return (
    <div className="space-y-8 pb-24 md:pb-0 h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-stone-500">Plan your schedule and set reminders.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-6 py-3 rounded-2xl font-black transition-all shadow-lg shadow-orange-100 uppercase tracking-widest text-xs"
        >
          <Plus size={20} />
          Add Event
        </button>
      </div>

      <div className="flex-1 bg-white p-6 rounded-[2.5rem] border border-stone-100 shadow-sm overflow-hidden">
        <style>{`
          .fc { font-family: inherit; --fc-border-color: #f1f5f9; --fc-today-bg-color: #fff7ed; }
          .fc .fc-toolbar-title { font-size: 1.25rem; font-weight: 800; color: #1c1917; text-transform: uppercase; letter-spacing: -0.02em; }
          .fc .fc-button-primary { background-color: #f8fafc; border-color: #e2e8f0; color: #64748b; font-weight: 700; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.05em; padding: 0.6rem 1.2rem; border-radius: 0.75rem; }
          .fc .fc-button-primary:hover { background-color: #f1f5f9; border-color: #cbd5e1; color: #1e293b; }
          .fc .fc-button-primary:not(:disabled).fc-button-active { background-color: #ea580c; border-color: #ea580c; color: white; }
          .fc .fc-col-header-cell-cushion { padding: 1rem; color: #94a3b8; font-weight: 800; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.1em; }
          .fc .fc-daygrid-day-number { padding: 0.75rem; font-weight: 700; color: #64748b; }
          .fc-theme-standard td, .fc-theme-standard th { border: 1px solid #f1f5f9; }
          .fc .fc-event { border-radius: 0.5rem; padding: 4px 8px; font-size: 0.7rem; font-weight: 800; border: none; text-transform: uppercase; letter-spacing: 0.02em; }
        `}</style>
        
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
        />
      </div>

      {/* View Event Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div 
                  className="w-4 h-12 rounded-full" 
                  style={{ backgroundColor: selectedEvent.color }}
                />
                <div>
                  <h2 className="text-2xl font-black text-stone-900">{selectedEvent.title}</h2>
                  <p className="text-stone-500 font-bold text-sm mt-1">
                    {format(selectedEvent.startTime.toDate(), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedEvent(null)} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-6 mb-8">
              <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-2xl">
                <Clock className="text-stone-400" size={24} />
                <div>
                  <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Time</p>
                  <p className="font-black text-stone-900">
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
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 py-4 rounded-2xl font-black transition-all"
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
                  className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-4 rounded-2xl font-black transition-all"
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
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">New Event</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-stone-400 hover:bg-stone-100 rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddEvent} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">Event Title</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <CalendarIcon className="text-stone-400" size={20} />
                  </div>
                  <input 
                    autoFocus
                    type="text" 
                    required
                    placeholder="What's happening?" 
                    className="w-full pl-12 pr-6 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all text-lg font-bold"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">Start Time</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Clock className="text-stone-400" size={16} />
                    </div>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full pl-10 pr-4 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-sm"
                      value={newStart}
                      onChange={(e) => setNewStart(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">End Time</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Clock className="text-stone-400" size={16} />
                    </div>
                    <input 
                      type="datetime-local" 
                      required
                      className="w-full pl-10 pr-4 py-4 bg-stone-50 border-none rounded-2xl focus:ring-2 focus:ring-orange-500 transition-all font-bold text-sm"
                      value={newEnd}
                      onChange={(e) => setNewEnd(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-stone-500 uppercase tracking-wider">Label Color</label>
                <div className="flex gap-3">
                  {['#ea580c', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={`w-10 h-10 rounded-full transition-all ${newColor === color ? 'ring-4 ring-stone-100 scale-110' : 'hover:scale-105'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-orange-600 hover:bg-orange-500 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-orange-100 transition-all mt-4 uppercase tracking-widest"
              >
                Create Event
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
