import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, addDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { GoogleGenAI } from '@google/genai';
import Markdown from 'react-markdown';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { Trash2, Send, Bot, Utensils, Flame, Plus, X, BarChart2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DietLog {
  id: string;
  userId: string;
  food: string;
  calories: number;
  date: Timestamp;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

const Diet: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<DietLog[]>([]);
  const [newFood, setNewFood] = useState('');
  const [newCalories, setNewCalories] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'diet_logs'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DietLog)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'diet_logs');
    });

    return unsubscribe;
  }, [user]);

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newFood.trim() || !newCalories || !newDate) return;

    try {
      // Create date object at midday to avoid timezone shifts
      const dateObj = new Date(`${newDate}T12:00:00`);
      
      await addDoc(collection(db, 'diet_logs'), {
        userId: user.uid,
        food: newFood,
        calories: Number(newCalories),
        date: Timestamp.fromDate(dateObj)
      });
      setNewFood('');
      setNewCalories('');
      setNewDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'diet_logs');
    }
  };

  const handleDeleteLog = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'diet_logs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `diet_logs/${id}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMessage.trim()) return;

    const userMsg = currentMessage;
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setCurrentMessage('');
    setIsChatLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Calculate weekly calories for context
      const now = new Date();
      const weekStart = startOfWeek(now);
      const weekEnd = endOfWeek(now);
      
      const weeklyLogs = logs.filter(log => 
        isWithinInterval(log.date.toDate(), { start: weekStart, end: weekEnd })
      );
      
      const totalWeeklyCalories = weeklyLogs.reduce((sum, log) => sum + log.calories, 0);
      
      let contextStr = `User's diet logs for this week (Total: ${totalWeeklyCalories} kcal):\n`;
      weeklyLogs.forEach(log => {
        contextStr += `- ${log.food}: ${log.calories} kcal on ${format(log.date.toDate(), 'MMM d')}\n`;
      });

      const contents = chatMessages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.text }]
      }));
      contents.push({ role: 'user', parts: [{ text: userMsg }] });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: contents,
        config: {
          systemInstruction: `You are an expert AI Dietitian. The user is asking for diet advice. Here is their weekly context:\n${contextStr}`
        }
      });

      setChatMessages(prev => [...prev, { role: 'model', text: response.text || "I'm sorry, I couldn't generate a response." }]);
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      setChatMessages(prev => [...prev, { role: 'model', text: `Error: ${error.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const todayLogs = logs.filter(log => {
    const logDate = log.date.toDate();
    const today = new Date();
    return logDate.getDate() === today.getDate() && 
           logDate.getMonth() === today.getMonth() && 
           logDate.getFullYear() === today.getFullYear();
  });

  const todayCalories = todayLogs.reduce((sum, log) => sum + log.calories, 0);

  const chartData = useMemo(() => {
    const data = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = format(d, 'MMM dd');
      
      const dayLogs = logs.filter(log => {
        const logDate = log.date.toDate();
        return logDate.getDate() === d.getDate() && 
               logDate.getMonth() === d.getMonth() && 
               logDate.getFullYear() === d.getFullYear();
      });
      
      const cals = dayLogs.reduce((sum, log) => sum + log.calories, 0);
      data.push({ name: dateStr, calories: cals });
    }
    return data;
  }, [logs]);

  return (
    <div className="space-y-8 pb-24 md:pb-0 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Diet & Calories</h1>
        <p className="text-on-surface-variant">Track your meals and get AI-powered diet advice.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Left Column: Tracking */}
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest p-6 rounded-[2.5rem] border border-outline-variant/20 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-on-surface flex items-center gap-2">
                <Flame className="text-primary" /> Today's Calories
              </h2>
              <span className="text-3xl font-black text-primary">{todayCalories} <span className="text-sm text-on-surface-variant font-bold uppercase tracking-widest">kcal</span></span>
            </div>

            <form onSubmit={handleAddLog} className="flex flex-wrap gap-3 mb-6">
              <input 
                type="date" 
                className="w-full sm:w-auto bg-surface-container-low border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-primary text-on-surface"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                required
              />
              <input 
                type="text" 
                placeholder="Food item..." 
                className="flex-1 min-w-[150px] bg-surface-container-low border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-primary text-on-surface"
                value={newFood}
                onChange={e => setNewFood(e.target.value)}
                required
              />
              <input 
                type="number" 
                placeholder="Calories" 
                className="w-28 bg-surface-container-low border-none rounded-2xl px-4 py-3 focus:ring-2 focus:ring-primary text-on-surface"
                value={newCalories}
                onChange={e => setNewCalories(e.target.value)}
                required
                min="0"
              />
              <button type="submit" className="bg-primary text-on-primary p-3 rounded-2xl hover:opacity-90 transition-all">
                <Plus size={24} />
              </button>
            </form>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 dark-scrollbar">
              {todayLogs.length === 0 ? (
                <p className="text-center text-on-surface-variant py-4 text-sm">No meals logged today.</p>
              ) : (
                todayLogs.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-4 bg-surface-container-low rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Utensils size={18} className="text-on-surface-variant" />
                      <span className="font-bold text-on-surface">{log.food}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-primary">{log.calories} kcal</span>
                      <button onClick={() => handleDeleteLog(log.id)} className="text-on-surface-variant hover:text-error transition-colors">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Historical Data Chart */}
          <div className="bg-surface-container-lowest p-6 rounded-[2.5rem] border border-outline-variant/20 shadow-sm">
            <h2 className="text-xl font-black text-on-surface flex items-center gap-2 mb-6">
              <BarChart2 className="text-primary" /> 7-Day History
            </h2>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 12 }}
                  />
                  <Tooltip 
                    cursor={{ fill: 'var(--color-surface-container-highest)', opacity: 0.4 }}
                    contentStyle={{ 
                      backgroundColor: 'var(--color-surface-container-highest)', 
                      border: 'none',
                      borderRadius: '12px',
                      color: 'var(--color-on-surface)',
                      fontWeight: 'bold'
                    }}
                    itemStyle={{ color: 'var(--color-primary)' }}
                  />
                  <Bar dataKey="calories" radius={[6, 6, 6, 6]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 6 ? 'var(--color-primary)' : 'var(--color-primary-container)'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right Column: AI Chat */}
        <div className="bg-surface-container-lowest p-6 rounded-[2.5rem] border border-outline-variant/20 shadow-sm flex flex-col h-[600px] lg:h-auto">
          <h2 className="text-xl font-black text-on-surface flex items-center gap-2 mb-6">
            <Bot className="text-secondary" /> AI Dietitian
          </h2>
          
          <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2 dark-scrollbar">
            {chatMessages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-surface-container-low rounded-3xl border border-outline-variant/10">
                <Bot size={48} className="text-secondary mb-4 opacity-50" />
                <p className="text-on-surface-variant font-medium">Ask me about your weekly diet, meal planning, or nutrition advice!</p>
              </div>
            ) : (
              chatMessages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] p-4 rounded-2xl ${
                    msg.role === 'user' 
                      ? 'bg-primary text-on-primary rounded-tr-sm' 
                      : 'bg-surface-container-high text-on-surface rounded-tl-sm'
                  }`}>
                    {msg.role === 'model' ? (
                      <div className="markdown-body text-sm">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    ) : (
                      <p className="text-sm font-medium">{msg.text}</p>
                    )}
                  </div>
                </div>
              ))
            )}
            {isChatLoading && (
              <div className="flex justify-start">
                <div className="bg-surface-container-high text-on-surface p-4 rounded-2xl rounded-tl-sm flex items-center gap-2">
                  <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                  <div className="w-2 h-2 bg-on-surface-variant rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            )}
          </div>

          <form onSubmit={handleSendMessage} className="relative mt-auto">
            <input 
              type="text" 
              placeholder="Ask about your diet..." 
              className="w-full bg-surface-container-low border-none rounded-2xl pl-6 pr-14 py-4 focus:ring-2 focus:ring-secondary text-on-surface"
              value={currentMessage}
              onChange={e => setCurrentMessage(e.target.value)}
            />
            <button 
              type="submit" 
              disabled={isChatLoading || !currentMessage.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-secondary text-on-secondary rounded-xl hover:opacity-90 disabled:opacity-50 transition-all"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Diet;
