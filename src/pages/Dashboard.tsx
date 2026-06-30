import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Clock, 
  CheckCircle2, 
  Calendar as CalendarIcon, 
  Play, 
  ArrowRight,
  CheckSquare,
  Repeat,
  Timer,
  Zap,
  ChevronRight,
  TrendingUp,
  Star,
  Flame
} from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { db, collection, query, where, onSnapshot, Timestamp, doc, setDoc, deleteDoc, handleFirestoreError, OperationType, getDocs } from '../firebase';
import { Task, Routine, RoutineLog } from '../types';
import { Link } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Trash2, Mail } from 'lucide-react';
import { generateMonthlyReportHTML } from '../utils/report';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Dashboard: React.FC = () => {
  const { profile, user, googleAccessToken, connectGoogleCalendar } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>([]);
  const [todayCalories, setTodayCalories] = useState(0);
  const [localEvents, setLocalEvents] = useState<any[]>([]);
  const [googleEvents, setGoogleEvents] = useState<any[]>(() => {
    const cached = localStorage.getItem('cachedGoogleEvents');
    return cached ? JSON.parse(cached) : [];
  });

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    const tasksQuery = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid)
    );

    const routinesQuery = query(
      collection(db, 'routines'),
      where('userId', '==', user.uid),
      where('isActive', '==', true)
    );

    const logsQuery = query(
      collection(db, 'routine_logs'),
      where('userId', '==', user.uid),
      where('logDate', '==', today)
    );

    const dietQuery = query(
      collection(db, 'diet_logs'),
      where('userId', '==', user.uid)
    );

    const eventsQuery = query(
      collection(db, 'calendar_events'),
      where('userId', '==', user.uid)
    );

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    const unsubRoutines = onSnapshot(routinesQuery, (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine)));
    });

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setRoutineLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoutineLog)));
    });

    const unsubDiet = onSnapshot(dietQuery, (snapshot) => {
      let cals = 0;
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const date = data.date.toDate();
        if (format(date, 'yyyy-MM-dd') === today) {
          cals += data.calories;
        }
      });
      setTodayCalories(cals);
    });

    const unsubEvents = onSnapshot(eventsQuery, (snapshot) => {
      setLocalEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTasks();
      unsubRoutines();
      unsubLogs();
      unsubDiet();
      unsubEvents();
    };
  }, [user]);

  useEffect(() => {
    const fetchGoogleEvents = async () => {
      if (!googleAccessToken) return;
      try {
        const timeMin = new Date();
        timeMin.setHours(0, 0, 0, 0);
        const timeMax = new Date();
        timeMax.setHours(23, 59, 59, 999);
        
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${timeMin.toISOString()}&timeMax=${timeMax.toISOString()}&maxResults=10&singleEvents=true&orderBy=startTime`, {
          headers: { Authorization: `Bearer ${googleAccessToken}` }
        });
        
        if (res.ok) {
          const data = await res.json();
          const items = data.items || [];
          setGoogleEvents(items);
          localStorage.setItem('cachedGoogleEvents', JSON.stringify(items));
        } else if (res.status === 401) {
          console.warn("Google token expired. Using cached events.");
        }
      } catch (error) {
        console.error("Failed to fetch Google Calendar events", error);
      }
    };

    fetchGoogleEvents();
  }, [googleAccessToken]);

  const toggleRoutineLog = async (routineId: string) => {
    if (!user) return;
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    const existingLog = routineLogs.find(log => log.routineId === routineId && log.logDate === dateStr);
    
    const logId = existingLog?.id || `${routineId}_${dateStr}`;
    const logRef = doc(db, 'routine_logs', logId);

    try {
      await setDoc(logRef, {
        routineId,
        logDate: dateStr,
        done: !existingLog?.done,
        userId: user.uid
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `routine_logs/${logId}`);
    }
  };

  const handleDeleteEvent = async (id: string, isGoogle?: boolean, googleEventId?: string) => {
    if (!window.confirm('Are you sure you want to delete this event?')) return;
    try {
      if (isGoogle && googleAccessToken) {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${googleAccessToken}` }
        });
        if (res.status === 401) {
          alert('Google Calendar session expired. Please connect again from the calendar view to delete this event.');
          return;
        }
        setGoogleEvents(prev => prev.filter(e => e.id !== id));
      } else {
        await deleteDoc(doc(db, 'calendar_events', id));
        if (googleEventId && googleAccessToken) {
          const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${googleEventId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${googleAccessToken}` }
          });
          if (res.status === 401) {
            alert('Local event deleted. Google Calendar sync failed because session expired.');
          } else {
            setGoogleEvents(prev => prev.filter(e => e.id !== googleEventId));
          }
        }
      }
    } catch (error) {
      if (!isGoogle) {
        handleFirestoreError(error, OperationType.DELETE, `calendar_events/${id}`);
      } else {
        console.error("Failed to delete Google event", error);
      }
    }
  };

  const [isSendingReport, setIsSendingReport] = useState(false);

  const handleSendMonthlyReport = async () => {
    if (!user) return;
    if (!googleAccessToken) {
      alert("Please connect your Google Workspace account to send emails. Make sure to allow Gmail access.");
      connectGoogleCalendar();
      return;
    }

    try {
      setIsSendingReport(true);
      
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Fetch completed tasks this month
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', user.uid),
        where('status', '==', 'done')
      );
      const tasksSnap = await getDocs(tasksQuery);
      const allTasks = tasksSnap.docs.map(doc => doc.data());
      const monthlyTasks = allTasks.filter(t => {
        if (!t.dueDate) return false;
        const d = t.dueDate.toDate();
        return d >= monthStart && d <= monthEnd;
      });

      // Fetch journal entries this month
      const journalQuery = query(
        collection(db, 'journal'),
        where('userId', '==', user.uid),
        where('createdAt', '>=', Timestamp.fromDate(monthStart)),
        where('createdAt', '<=', Timestamp.fromDate(monthEnd))
      );
      const journalSnap = await getDocs(journalQuery);
      const monthlyJournals = journalSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          dateString: data.dateString || format(data.createdAt.toDate(), 'yyyy-MM-dd')
        };
      });

      const monthName = format(now, 'MMMM yyyy');
      const htmlContent = generateMonthlyReportHTML(monthlyTasks, monthlyJournals, monthName);

      const emailLines = [
        `To: ${user.email}`,
        `Subject: Your DailyFlow Summary for ${monthName}`,
        'Content-Type: text/html; charset=utf-8',
        '',
        htmlContent
      ];
      const email = emailLines.join('\r\n');
      
      const base64EncodedEmail = btoa(unescape(encodeURIComponent(email)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
        
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: base64EncodedEmail
        })
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          alert("Gmail access expired or not granted. Please reconnect your account and ensure you check the box for Gmail permissions.");
          connectGoogleCalendar();
        } else {
          throw new Error('Failed to send email');
        }
        return;
      }

      alert("Monthly summary successfully sent to your email!");
    } catch (error) {
      console.error("Failed to send report:", error);
      alert("Failed to send the report. Please try again later.");
    } finally {
      setIsSendingReport(false);
    }
  };

  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    const date = t.dueDate.toDate();
    return format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
  });

  const completedTasks = todayTasks.filter(t => t.status === 'done').length;
  const remainingTasks = todayTasks.length - completedTasks;
  const taskProgress = todayTasks.length > 0 ? (completedTasks / todayTasks.length) * 100 : 0;

  const currentDayOfWeek = new Date().getDay();
  const todayRoutines = routines.filter(r => r.daysOfWeek.includes(currentDayOfWeek));
  const completedRoutines = todayRoutines.filter(r => routineLogs.some(log => log.routineId === r.id && log.done)).length;
  const routineProgress = todayRoutines.length > 0 ? (completedRoutines / todayRoutines.length) * 100 : 0;

  const nextTask = todayTasks.find(t => t.status === 'todo');

  const enabledModules = profile?.enabledModules || [];
  const hasTasks = enabledModules.includes('tasks');
  const hasRoutines = enabledModules.includes('routines');
  const hasFocus = enabledModules.includes('focus');
  const hasDiet = enabledModules.includes('diet');
  const hasCalendar = enabledModules.includes('calendar');

  const todayEvents = [
    ...localEvents.map(e => ({
      id: e.id,
      title: e.title,
      start: e.startTime.toDate(),
      end: e.endTime.toDate(),
      isGoogle: false,
      color: e.color || '#primary'
    })),
    ...googleEvents
      .filter(gEvent => !localEvents.some(e => e.googleEventId === gEvent.id))
      .map(event => ({
        id: event.id,
        title: event.summary,
        start: new Date(event.start?.dateTime || event.start?.date),
        end: new Date(event.end?.dateTime || event.end?.date),
        isGoogle: true,
        color: '#4285F4'
      }))
  ]
  .filter(e => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return format(e.start, 'yyyy-MM-dd') === todayStr;
  })
  .sort((a, b) => a.start.getTime() - b.start.getTime());

  return (
    <div className="space-y-10 pb-20 md:pb-10">
      {/* Header & Clock */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mb-2">
            {format(currentTime, 'EEEE, MMMM do')}
          </h2>
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            Hey, {profile?.displayName.split(' ')[0] || 'User'}
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button 
            onClick={handleSendMonthlyReport}
            disabled={isSendingReport}
            className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-primary text-on-primary font-bold shadow-sm hover:shadow-md hover:bg-primary/90 transition-all w-full sm:w-auto"
          >
            <Mail size={20} />
            {isSendingReport ? "Sending..." : "Email Monthly Summary"}
          </button>
          
          <div className="bg-surface-container-lowest px-6 py-4 rounded-2xl shadow-sm border border-outline-variant/20 flex items-center gap-4 w-full sm:w-auto">
            <Clock className="text-primary" size={24} />
            <div className="flex flex-col">
              <p className="text-3xl font-semibold tracking-tight text-on-surface leading-none flex items-baseline gap-1">
                {format(currentTime, 'h:mm')}
                <span className="text-xl text-on-surface-variant font-medium">{format(currentTime, ':ss a')}</span>
              </p>
              <p className="text-xs font-medium text-on-surface-variant mt-1">Live Time</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Stats & Progress */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Task Progress Card */}
            {hasTasks && (
            <div className="bg-surface-container-highest rounded-3xl p-8 text-on-surface shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <CheckSquare size={120} />
              </div>
              <div className="relative z-10">
                <h3 className="text-on-surface-variant font-semibold text-xs uppercase tracking-wider mb-8 flex items-center gap-2">
                  <TrendingUp size={14} className="text-primary" />
                  Daily Velocity
                </h3>
                <div className="flex items-end gap-4 mb-6">
                  <p className="text-6xl font-bold tracking-tight">
                    {completedTasks}<span className="text-outline-variant text-3xl">/{todayTasks.length}</span>
                  </p>
                </div>
                <div className="w-full h-3 bg-surface-container-lowest rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-out"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
                <p className="text-on-surface-variant text-sm font-medium">
                  {remainingTasks === 0 && todayTasks.length > 0 
                    ? "Peak performance achieved." 
                    : `${remainingTasks} objectives remaining.`}
                </p>
              </div>
            </div>
            )}

            {/* Routine Progress Card */}
            {hasRoutines && (
            <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/20 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Repeat size={120} />
              </div>
              <div className="relative z-10">
                <h3 className="text-on-surface-variant font-semibold text-xs uppercase tracking-wider mb-8 flex items-center gap-2">
                  <Star size={14} className="text-primary" />
                  Consistency Flow
                </h3>
                <div className="flex items-end gap-4 mb-6">
                  <p className="text-6xl font-bold tracking-tight text-on-surface">
                    {completedRoutines}<span className="text-outline-variant text-3xl">/{todayRoutines.length}</span>
                  </p>
                </div>
                <div className="w-full h-3 bg-surface-container-low rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-primary transition-all duration-1000 ease-out"
                    style={{ width: `${routineProgress}%` }}
                  />
                </div>
                <p className="text-on-surface-variant text-sm font-medium">
                  {routineProgress === 100 ? "Flow state maintained." : "Keep the momentum going."}
                </p>
              </div>
            </div>
            )}
          </div>

          {/* Next Objective Card */}
          {hasTasks && (
          <div className="bg-primary-container/20 rounded-3xl p-8 border border-primary/20 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-on-primary shadow-md shadow-primary/20">
                  <Zap size={28} fill="currentColor" />
                </div>
                <div>
                  <h3 className="text-on-surface-variant font-semibold text-xs uppercase tracking-wider mb-1">Next Objective</h3>
                  <p className="text-xl font-bold text-on-surface">
                    {nextTask ? nextTask.title : "No pending tasks"}
                  </p>
                  <p className="text-primary font-medium text-sm mt-1">
                    {nextTask ? `Priority: ${nextTask.priority}` : "Enjoy your free time!"}
                  </p>
                </div>
              </div>
              <Link to="/tasks" className="bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-surface-container transition-all shadow-md">
                Execute <ChevronRight size={20} />
              </Link>
            </div>
          </div>
          )}

          {/* Today's Schedule Card */}
          {hasCalendar && (
          <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-on-surface font-bold flex items-center gap-2">
                <CalendarIcon size={18} className="text-primary" />
                Today's Schedule
              </h3>
              <div className="flex items-center gap-3">
                {!googleAccessToken && (
                  <button 
                    onClick={connectGoogleCalendar}
                    className="text-xs font-semibold bg-surface-container-high px-3 py-1.5 rounded-lg hover:bg-surface-container-highest transition-colors flex items-center gap-1"
                  >
                    Connect Google
                  </button>
                )}
                <Link to="/calendar" className="text-outline-variant hover:text-on-surface transition-colors">
                  <ChevronRight size={20} />
                </Link>
              </div>
            </div>
            
            <div className="space-y-4">
              {todayEvents.length > 0 ? (
                todayEvents.map(event => (
                  <div key={event.id} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 hover:bg-surface-container transition-all group">
                    <div className="w-2 h-10 rounded-full" style={{ backgroundColor: event.color === '#primary' ? 'var(--color-primary)' : event.color }}></div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-on-surface">{event.title}</h4>
                      <p className="text-sm text-on-surface-variant">
                        {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                      </p>
                    </div>
                    {event.isGoogle && (
                      <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">G</span>
                      </div>
                    )}
                    <button 
                      onClick={() => handleDeleteEvent(event.id, event.isGoogle, (event as any).googleEventId)}
                      className="opacity-0 group-hover:opacity-100 p-2 text-error hover:bg-error-container/20 rounded-full transition-all"
                      title="Delete Event"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 bg-surface-container-low rounded-2xl border border-outline-variant/20 border-dashed">
                  <p className="text-on-surface-variant font-medium">No events scheduled for today.</p>
                  <Link to="/calendar" className="text-primary text-sm font-semibold mt-2 inline-block hover:underline">
                    Open Calendar
                  </Link>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Right Column: Quick Actions & Focus */}
        <div className="lg:col-span-4 space-y-8">
          {/* Diet Card */}
          {hasDiet && (
          <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/20 shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
              <Flame size={120} />
            </div>
            <div className="relative z-10">
              <h3 className="text-on-surface-variant font-semibold text-xs uppercase tracking-wider mb-8 flex items-center gap-2">
                <Flame size={14} className="text-primary" />
                Today's Calories
              </h3>
              <div className="flex items-end gap-4 mb-6">
                <p className="text-6xl font-bold tracking-tight text-on-surface">
                  {todayCalories}<span className="text-outline-variant text-3xl"> kcal</span>
                </p>
              </div>
              <Link to="/diet" className="text-primary font-semibold text-sm flex items-center gap-1 hover:underline">
                Log Meals <ChevronRight size={16} />
              </Link>
            </div>
          </div>
          )}

          {/* Focus Mode Card */}
          {hasFocus && (
          <div className="bg-surface-container-highest rounded-3xl p-8 text-on-surface shadow-lg flex flex-col justify-between min-h-[280px] relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 opacity-10">
              <Timer size={200} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-surface-container-lowest/10 rounded-2xl flex items-center justify-center mb-8">
                <Timer size={24} className="text-primary" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-3">Focus Zone</h3>
              <p className="text-on-surface-variant font-medium leading-relaxed mb-8">
                Eliminate distractions and enter deep work mode.
              </p>
            </div>
            <Link to="/focus" className="relative z-10 flex items-center gap-2 bg-primary text-on-primary hover:opacity-90 transition-all py-4 px-6 rounded-xl font-semibold w-full justify-center shadow-md">
              <Play size={20} fill="currentColor" className="ml-1" />
              Enter Focus
            </Link>
          </div>
          )}

          {/* Quick Routine List */}
          {hasRoutines && (
          <div className="bg-surface-container-lowest rounded-3xl p-8 border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-on-surface font-bold flex items-center gap-2">
                <Repeat size={18} className="text-primary" />
                Checklist
              </h3>
              <Link to="/routines" className="text-outline-variant hover:text-on-surface transition-colors">
                <ChevronRight size={20} />
              </Link>
            </div>
            <div className="space-y-4">
              {todayRoutines.slice(0, 4).map(routine => {
                const isDone = routineLogs.some(log => log.routineId === routine.id && log.done);
                return (
                  <div 
                    key={routine.id} 
                    onClick={() => toggleRoutineLog(routine.id)}
                    className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container-low border border-outline-variant/20 group hover:bg-surface-container hover:shadow-md transition-all cursor-pointer"
                  >
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isDone ? "bg-primary border-primary" : "border-outline-variant group-hover:border-primary/50"
                    )}>
                      {isDone && <CheckCircle2 size={12} className="text-on-primary" />}
                    </div>
                    <span className={cn(
                      "flex-1 text-sm font-semibold transition-all",
                      isDone ? "text-outline-variant line-through" : "text-on-surface"
                    )}>
                      {routine.title}
                    </span>
                  </div>
                );
              })}
              {todayRoutines.length === 0 && (
                <p className="text-on-surface-variant text-sm font-bold italic text-center py-4">No routines today.</p>
              )}
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
