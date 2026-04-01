import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Plus, 
  X, 
  Repeat, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Flame, 
  Trash2, 
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Bell,
  Info,
  Zap
} from 'lucide-react';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, setDoc, handleFirestoreError, OperationType } from '../firebase';
import { Routine, RoutineLog } from '../types';
import { format, startOfDay, subDays, isSameDay, addDays, startOfWeek } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Routines: React.FC = () => {
  const { user } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('08:00');
  const [newDays, setNewDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newColor, setNewColor] = useState('bg-orange-500');

  useEffect(() => {
    if (!user) return;

    const routinesQuery = query(collection(db, 'routines'), where('userId', '==', user.uid));
    const logsQuery = query(collection(db, 'routine_logs'), where('userId', '==', user.uid));

    const unsubRoutines = onSnapshot(routinesQuery, (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'routines');
    });

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setRoutineLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoutineLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'routine_logs');
    });

    return () => {
      unsubRoutines();
      unsubLogs();
    };
  }, [user]);

  const handleAddRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    const newRoutine: Omit<Routine, 'id'> = {
      title: newTitle,
      timeOfDay: newTime,
      daysOfWeek: newDays,
      isActive: true,
      color: newColor,
      userId: user.uid,
    };

    try {
      await addDoc(collection(db, 'routines'), newRoutine);
      setIsAddModalOpen(false);
      setNewTitle('');
      setNewTime('08:00');
      setNewDays([1, 2, 3, 4, 5]);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'routines');
    }
  };

  const toggleRoutineLog = async (routineId: string) => {
    if (!user) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
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

  const deleteRoutine = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this routine?')) return;
    try {
      await deleteDoc(doc(db, 'routines', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `routines/${id}`);
    }
  };

  const daysLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDayOfWeek = selectedDate.getDay();
  const activeRoutinesForDay = routines.filter(r => r.isActive && r.daysOfWeek.includes(currentDayOfWeek));

  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));

  const isToday = isSameDay(selectedDate, new Date());
  const dateLabel = isToday ? "Today's" : format(selectedDate, "EEEE's");

  return (
    <div className="space-y-10 pb-24 md:pb-10 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-on-surface">Routines</h1>
          <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mt-1">Build Better Habits</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-on-primary px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={20} />
          Add
        </button>
      </div>

      {/* Week Selector */}
      <div className="bg-surface-container-lowest p-4 rounded-[2rem] border border-outline-variant/20 shadow-sm flex justify-between items-center overflow-x-auto hide-scrollbar gap-2">
        {weekDays.map(day => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentDay = isSameDay(day, new Date());
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "flex flex-col items-center justify-center min-w-[3rem] h-16 rounded-2xl transition-all",
                isSelected 
                  ? "bg-primary text-on-primary shadow-md shadow-primary/20" 
                  : isCurrentDay
                    ? "bg-primary-container/50 text-primary hover:bg-primary-container"
                    : "hover:bg-surface-container text-on-surface-variant"
              )}
            >
              <span className="text-[10px] font-bold uppercase tracking-widest mb-1">{format(day, 'EEE')}</span>
              <span className="text-lg font-black leading-none">{format(day, 'd')}</span>
            </button>
          );
        })}
      </div>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-on-surface">{dateLabel} Alarms</h2>
          <span className="text-xs font-bold text-primary uppercase tracking-wider">{activeRoutinesForDay.length} Active</span>
        </div>
        <div className="space-y-4">
          {activeRoutinesForDay.length === 0 ? (
            <div className="text-center py-8 bg-surface-container-lowest rounded-[2rem] border border-outline-variant/20 border-dashed">
              <p className="text-on-surface-variant font-medium">No alarms set for this day.</p>
            </div>
          ) : (
            activeRoutinesForDay.map(routine => (
              <div key={routine.id} className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm flex items-center justify-between group">
                <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
                  <div className={cn("w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-full flex items-center justify-center text-white shadow-inner", routine.color || 'bg-primary')}>
                    <Bell size={24} className="md:w-7 md:h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl md:text-2xl font-mono font-black text-on-surface leading-none mb-1 truncate">{routine.timeOfDay}</p>
                    <p className="text-xs md:text-sm font-medium text-on-surface-variant truncate">{routine.title}</p>
                  </div>
                </div>
                <button 
                  onClick={() => deleteRoutine(routine.id)}
                  className="p-3 text-outline-variant hover:text-error opacity-100 md:opacity-0 group-hover:opacity-100 transition-all shrink-0"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-on-surface">Daily Progress</h2>
          <button className="p-2 bg-surface-container text-on-surface-variant rounded-full">
            <Info size={16} />
          </button>
        </div>
        <div className="space-y-4">
          {routines.map(routine => {
            const isDone = routineLogs.some(l => l.routineId === routine.id && l.logDate === format(selectedDate, 'yyyy-MM-dd') && l.done);
            return (
              <div key={routine.id} className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-6 flex-1 min-w-0">
                  <div className={cn("w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-2xl flex items-center justify-center text-white shadow-inner", routine.color || 'bg-primary', !isDone && "opacity-50 grayscale")}>
                    <Repeat size={24} className="md:w-7 md:h-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-base md:text-lg font-black leading-none mb-1 truncate transition-colors", isDone ? "text-on-surface" : "text-on-surface-variant")}>{routine.title}</p>
                    <p className="text-[10px] font-bold text-tertiary uppercase tracking-widest truncate">
                      {routine.daysOfWeek.length === 7 ? 'Every Day' : routine.daysOfWeek.map(d => daysLabels[d]).join(', ')}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => toggleRoutineLog(routine.id)}
                  className={cn(
                    "w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center shrink-0",
                    isDone ? "justify-end" : "bg-surface-container-highest justify-start",
                    isDone && (routine.color || 'bg-primary')
                  )}
                >
                  <div className="w-6 h-6 bg-white rounded-full shadow-sm" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Mindfulness Tip Card */}
      <div className="bg-tertiary-container rounded-[2.5rem] p-10 text-on-tertiary-container relative overflow-hidden shadow-2xl shadow-tertiary/20">
        <div className="relative z-10">
          <p className="text-[10px] font-black text-tertiary uppercase tracking-[0.2em] mb-4">Mindfulness Tip</p>
          <h3 className="text-3xl font-black leading-tight mb-8 max-w-xs">
            Set boundaries for your notifications to preserve focus flow.
          </h3>
          <button className="flex items-center gap-2 font-black text-lg hover:gap-4 transition-all group">
            Manage Focus <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
        <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
          <Zap size={200} />
        </div>
      </div>

      {/* Add Routine Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-on-surface">New Reminder</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddRoutine} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Title</label>
                <input 
                  autoFocus
                  type="text" 
                  required
                  placeholder="e.g. Morning Meditation" 
                  className="w-full px-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-lg text-on-surface placeholder:text-on-surface-variant"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Time</label>
                  <input 
                    type="time" 
                    required
                    className="w-full px-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-on-surface"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Color</label>
                  <div className="flex gap-2">
                    {['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-red-500', 'bg-purple-500'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewColor(color)}
                        className={cn(
                          "w-8 h-8 rounded-full transition-all",
                          color,
                          newColor === color ? 'ring-4 ring-outline-variant scale-110' : 'hover:scale-105'
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Repeat on</label>
                <div className="flex justify-between gap-1">
                  {daysLabels.map((day, index) => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        if (newDays.includes(index)) {
                          setNewDays(newDays.filter(d => d !== index));
                        } else {
                          setNewDays([...newDays, index]);
                        }
                      }}
                      className={cn(
                        "flex-1 py-3 rounded-xl text-xs font-bold transition-all",
                        newDays.includes(index) ? "bg-primary text-on-primary" : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
                      )}
                    >
                      {day.charAt(0)}
                    </button>
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-primary hover:opacity-90 text-on-primary py-4 rounded-2xl font-bold text-lg shadow-lg shadow-primary/20 transition-all mt-4"
              >
                Create Reminder
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Routines;

