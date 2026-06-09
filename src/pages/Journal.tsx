import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { Edit2, Trash2, Calendar as CalendarIcon, Save, ChevronLeft, ChevronRight, PenLine } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface JournalEntry {
  id: string;
  userId: string;
  title?: string;
  subtitle?: string;
  text: string;
  createdAt: Timestamp;
  dateString?: string;
}

export default function Journal() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  
  const [newEntryTitle, setNewEntryTitle] = useState('');
  const [newEntrySubtitle, setNewEntrySubtitle] = useState('');
  const [newEntryText, setNewEntryText] = useState('');
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editText, setEditText] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'journal'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as JournalEntry));
      fetchedEntries.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
      setEntries(fetchedEntries);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'journal');
    });

    return unsubscribe;
  }, [user]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (!newEntryText.trim() && !newEntryTitle.trim())) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    try {
      await addDoc(collection(db, 'journal'), {
        userId: user.uid,
        title: newEntryTitle.trim(),
        subtitle: newEntrySubtitle.trim(),
        text: newEntryText,
        createdAt: Timestamp.now(),
        dateString: dateStr,
      });
      setNewEntryTitle('');
      setNewEntrySubtitle('');
      setNewEntryText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'journal');
    }
  };

  const handleEditEntry = async () => {
    if (!editingId || (!editText.trim() && !editTitle.trim())) return;

    try {
      await updateDoc(doc(db, 'journal', editingId), {
        title: editTitle.trim(),
        subtitle: editSubtitle.trim(),
        text: editText
      });
      setEditingId(null);
      setEditTitle('');
      setEditSubtitle('');
      setEditText('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'journal');
    }
  };

  const handleDeleteEntry = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await deleteDoc(doc(db, 'journal', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'journal');
    }
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const onDateClick = (day: Date) => setSelectedDate(day);

  // Calendar generation
  const daysInMonth = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = [];
    let day = startDate;
    while (day <= endDate) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  // Filter entries for the selected date
  const selectedEntries = entries.filter(entry => {
    const entryDateStr = entry.dateString || format(entry.createdAt.toDate(), 'yyyy-MM-dd');
    return entryDateStr === selectedDateStr;
  });

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <header className="mb-8">
        <h1 className="text-4xl md:text-5xl font-black text-on-background tracking-tighter mb-4">
          Daily Diary
        </h1>
        <p className="text-on-surface-variant text-lg max-w-2xl">
          Capture your thoughts, reflections, and memorable moments every day.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[350px_1fr] gap-8">
        {/* Left Column: Calendar */}
        <div className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm h-fit">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-on-surface">
              {format(currentMonth, 'MMMM yyyy')}
            </h2>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                <ChevronLeft size={20} />
              </button>
              <button onClick={nextMonth} className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-on-surface-variant">
                <ChevronRight size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center font-semibold text-sm py-2 text-on-surface-variant/70">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {daysInMonth.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const hasEntries = entries.some(e => (e.dateString || format(e.createdAt.toDate(), 'yyyy-MM-dd')) === dayStr);
              const isSelected = isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <button
                  key={day.toString()}
                  onClick={() => onDateClick(day)}
                  className={cn(
                    "relative aspect-square flex items-center justify-center rounded-xl text-sm font-medium transition-all",
                    !isCurrentMonth && "text-on-surface-variant/30",
                    isCurrentMonth && !isSelected && "text-on-surface hover:bg-surface-container-high",
                    isSelected && "bg-primary text-on-primary font-bold shadow-md",
                    isToday(day) && !isSelected && "ring-2 ring-primary/30 text-primary font-bold"
                  )}
                >
                  {format(day, 'd')}
                  {hasEntries && (
                    <span className={cn(
                      "absolute bottom-1 w-1.5 h-1.5 rounded-full",
                      isSelected ? "bg-on-primary" : "bg-primary"
                    )} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Entries & Editor */}
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-on-surface">
              <CalendarIcon className="text-primary" />
              {format(selectedDate, 'EEEE, MMMM do, yyyy')}
            </h2>
            {isToday(selectedDate) && (
              <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-bold tracking-wide uppercase">
                Today
              </span>
            )}
          </div>

          {/* New Entry Form */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm"
          >
            <form onSubmit={handleAddEntry} className="space-y-4 flex flex-col">
              <input
                type="text"
                value={newEntryTitle}
                onChange={(e) => setNewEntryTitle(e.target.value)}
                placeholder="Main Heading (Optional)"
                className="w-full p-4 text-xl font-bold rounded-2xl bg-surface-container-low border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface placeholder:text-on-surface-variant/50 outline-none"
              />
              <input
                type="text"
                value={newEntrySubtitle}
                onChange={(e) => setNewEntrySubtitle(e.target.value)}
                placeholder="Sub Heading (Optional)"
                className="w-full px-4 py-3 text-md font-medium rounded-xl bg-surface-container-low border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface-variant placeholder:text-on-surface-variant/50 outline-none"
              />
              <textarea
                value={newEntryText}
                onChange={(e) => setNewEntryText(e.target.value)}
                placeholder="Write your thoughts for this day..."
                className="w-full h-32 p-4 rounded-2xl bg-surface-container-low border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none text-on-surface placeholder:text-on-surface-variant/50 outline-none"
              />
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!newEntryText.trim() && !newEntryTitle.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <PenLine size={18} />
                  Save Entry
                </button>
              </div>
            </form>
          </motion.div>

          {/* Selected Date Entries List */}
          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {selectedEntries.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="text-center py-12 text-on-surface-variant"
                >
                  <CalendarIcon size={48} className="mx-auto mb-4 opacity-20" />
                  <p>No journal entries for this day.</p>
                </motion.div>
              ) : (
                selectedEntries.map((entry, idx) => (
                  <motion.div
                    key={entry.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="bg-surface-container-lowest p-6 rounded-[2rem] border border-outline-variant/20 shadow-sm relative group"
                  >
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-outline-variant/20">
                      <div className="flex items-center gap-2 text-on-surface-variant font-medium text-sm">
                        <span>{format(entry.createdAt.toDate(), 'h:mm a')}</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingId(entry.id);
                            setEditTitle(entry.title || '');
                            setEditSubtitle(entry.subtitle || '');
                            setEditText(entry.text || '');
                          }}
                          className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteEntry(entry.id)}
                          className="p-2 rounded-lg text-error hover:bg-error-container hover:text-on-error-container transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {editingId === entry.id ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder="Main Heading"
                          className="w-full p-4 text-xl font-bold rounded-2xl bg-surface-container-low border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface outline-none"
                        />
                        <input
                          type="text"
                          value={editSubtitle}
                          onChange={(e) => setEditSubtitle(e.target.value)}
                          placeholder="Sub Heading"
                          className="w-full px-4 py-3 text-md font-medium rounded-xl bg-surface-container-low border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-on-surface-variant outline-none"
                        />
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full h-32 p-4 rounded-xl bg-surface-container-low border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none text-on-surface outline-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditTitle('');
                              setEditSubtitle('');
                              setEditText('');
                            }}
                            className="px-4 py-2 rounded-xl border border-outline-variant hover:bg-surface-container-high transition-colors text-on-surface font-medium"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleEditEntry}
                            disabled={!editText.trim() && !editTitle.trim()}
                            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-bold hover:bg-primary/90 transition-colors disabled:opacity-50"
                          >
                            Update
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {entry.title && (
                          <h3 className="text-2xl font-black text-on-surface leading-tight tracking-tight">
                            {entry.title}
                          </h3>
                        )}
                        {entry.subtitle && (
                          <h4 className="text-lg font-bold text-primary/80">
                            {entry.subtitle}
                          </h4>
                        )}
                        {entry.text && (
                          <p className={cn("whitespace-pre-wrap text-on-surface text-lg leading-relaxed", (entry.title || entry.subtitle) ? "pt-4 border-t border-outline-variant/20 mt-2" : "")}>
                            {entry.text}
                          </p>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
