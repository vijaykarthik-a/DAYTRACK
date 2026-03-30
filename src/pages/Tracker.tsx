import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Plus, 
  X, 
  Check,
  Trash2,
  Activity,
  Calendar as CalendarIcon
} from 'lucide-react';
import { db, collection, query, where, onSnapshot, addDoc, deleteDoc, doc, setDoc, handleFirestoreError, OperationType } from '../firebase';
import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Habit {
  id: string;
  title: string;
  color: string;
  userId: string;
}

interface HabitLog {
  id: string;
  habitId: string;
  date: string; // yyyy-MM-dd
  userId: string;
}

const Tracker: React.FC = () => {
  const { user } = useAuth();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLog[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('bg-orange-500');

  // AI Insights state
  const [isInsightsModalOpen, setIsInsightsModalOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsText, setInsightsText] = useState('');

  useEffect(() => {
    if (!user) return;

    const habitsQuery = query(collection(db, 'tracker_habits'), where('userId', '==', user.uid));
    const logsQuery = query(collection(db, 'tracker_logs'), where('userId', '==', user.uid));

    const unsubHabits = onSnapshot(habitsQuery, (snapshot) => {
      setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Habit)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tracker_habits');
    });

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HabitLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tracker_logs');
    });

    return () => {
      unsubHabits();
      unsubLogs();
    };
  }, [user]);

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    const newHabit: Omit<Habit, 'id'> = {
      title: newTitle,
      color: newColor,
      userId: user.uid,
    };

    try {
      await addDoc(collection(db, 'tracker_habits'), newHabit);
      setIsAddModalOpen(false);
      setNewTitle('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tracker_habits');
    }
  };

  const toggleLog = async (habitId: string, dateStr: string) => {
    if (!user) return;
    const existingLog = logs.find(log => log.habitId === habitId && log.date === dateStr);
    
    const logId = existingLog?.id || `${habitId}_${dateStr}`;
    const logRef = doc(db, 'tracker_logs', logId);

    try {
      if (existingLog) {
        await deleteDoc(logRef);
      } else {
        await setDoc(logRef, {
          habitId,
          date: dateStr,
          userId: user.uid
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `tracker_logs/${logId}`);
    }
  };

  const deleteHabit = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this tracker?')) return;
    try {
      await deleteDoc(doc(db, 'tracker_habits', id));
      // Note: Ideally we should also delete associated logs, but keeping it simple for now
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tracker_habits/${id}`);
    }
  };

  // Generate last 14 days for the tracker grid
  const today = new Date();
  const pastDays = Array.from({ length: 14 }).map((_, i) => subDays(today, 13 - i));

  const handleGetInsights = async () => {
    setIsInsightsModalOpen(true);
    setInsightsLoading(true);
    setInsightsText('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || 'AIzaSyB5QiiZEMrwfze-ShJa3Vly5hOWpgsCxak' });
      
      // Prepare data for AI
      let dataSummary = "User's Habits and Last 14 Days Logs:\n\n";
      habits.forEach(habit => {
        dataSummary += `Habit: ${habit.title}\n`;
        let completionCount = 0;
        pastDays.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isDone = logs.some(l => l.habitId === habit.id && l.date === dateStr);
          if (isDone) completionCount++;
        });
        dataSummary += `- Completed ${completionCount} out of 14 days.\n`;
      });

      const prompt = `Analyze the following habit tracking data and provide a short, encouraging summary with 1-2 actionable insights or tips for improvement. Keep it concise and friendly.\n\n${dataSummary}`;

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
    <div className="space-y-10 pb-24 md:pb-10 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-on-surface">Daily Tracker</h1>
          <p className="text-on-surface-variant font-bold text-xs uppercase tracking-widest mt-1">Build Consistency</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={handleGetInsights}
            className="flex items-center gap-2 bg-secondary-container hover:bg-secondary-container/80 text-on-secondary-container px-6 py-3 rounded-2xl font-black transition-all shadow-sm uppercase tracking-widest text-xs"
          >
            <Activity size={20} />
            AI Insights
          </button>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary px-6 py-3 rounded-2xl font-black transition-all shadow-lg shadow-primary/20 uppercase tracking-widest text-xs"
          >
            <Plus size={20} />
            Add Tracker
          </button>
        </div>
      </div>

      <div className="bg-surface-container-lowest p-8 rounded-[2.5rem] border border-outline-variant/20 shadow-sm overflow-x-auto">
        {habits.length === 0 ? (
          <div className="text-center py-12">
            <Activity size={48} className="mx-auto text-on-surface-variant/50 mb-4" />
            <h3 className="text-xl font-black text-on-surface mb-2">No trackers yet</h3>
            <p className="text-on-surface-variant">Create a tracker to start building daily habits.</p>
          </div>
        ) : (
          <div className="min-w-[600px]">
            {/* Header Row (Dates) */}
            <div className="flex mb-4 ml-48">
              {pastDays.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center justify-end pb-2">
                  <span className="text-[10px] font-bold text-on-surface-variant uppercase">{format(day, 'EEE')}</span>
                  <span className={cn(
                    "text-sm font-black",
                    isSameDay(day, today) ? "text-primary" : "text-on-surface"
                  )}>
                    {format(day, 'd')}
                  </span>
                </div>
              ))}
            </div>

            {/* Habit Rows */}
            <div className="space-y-3">
              {habits.map(habit => (
                <div key={habit.id} className="flex items-center group">
                  {/* Habit Info */}
                  <div className="w-48 flex items-center justify-between pr-4">
                    <div className="flex items-center gap-3 truncate">
                      <div className={cn("w-3 h-3 rounded-full shrink-0", habit.color)} />
                      <span className="font-bold text-on-surface truncate">{habit.title}</span>
                    </div>
                    <button 
                      onClick={() => deleteHabit(habit.id)}
                      className="text-on-surface-variant hover:text-error opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Habit Grid */}
                  <div className="flex-1 flex gap-1">
                    {pastDays.map((day, i) => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const isDone = logs.some(l => l.habitId === habit.id && l.date === dateStr);
                      
                      return (
                        <button
                          key={i}
                          onClick={() => toggleLog(habit.id, dateStr)}
                          className={cn(
                            "flex-1 aspect-square rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-110",
                            isDone 
                              ? habit.color 
                              : "bg-surface-container-low hover:bg-surface-container-high"
                          )}
                        >
                          {isDone && <Check size={14} className="text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Tracker Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-on-surface">New Tracker</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddHabit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Tracker Name</label>
                <input 
                  autoFocus
                  type="text" 
                  required
                  placeholder="e.g. Read 10 Pages, Workout" 
                  className="w-full px-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-lg font-bold text-on-surface placeholder:text-on-surface-variant/50"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Color</label>
                <div className="flex gap-3">
                  {['bg-orange-500', 'bg-blue-500', 'bg-emerald-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewColor(color)}
                      className={cn(
                        "w-10 h-10 rounded-full transition-all",
                        color,
                        newColor === color ? 'ring-4 ring-outline-variant scale-110' : 'hover:scale-105'
                      )}
                    />
                  ))}
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-on-primary py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all mt-4 uppercase tracking-widest"
              >
                Create Tracker
              </button>
            </form>
          </div>
        </div>
      )}
      {/* AI Insights Modal */}
      {isInsightsModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-on-surface flex items-center gap-2">
                <Activity className="text-primary" /> AI Insights
              </h2>
              <button onClick={() => setIsInsightsModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container-low rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <div className="min-h-[150px] max-h-[400px] overflow-y-auto pr-2 dark-scrollbar">
              {insightsLoading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4 py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-on-surface-variant font-medium animate-pulse">Analyzing your habits...</p>
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

export default Tracker;
