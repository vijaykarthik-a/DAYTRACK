import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle,
  ChevronDown,
  X,
  CheckSquare
} from 'lucide-react';
import { db, collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { Task } from '../types';
import { format, isToday, isThisWeek, isThisMonth } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Tasks: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterDate, setFilterDate] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state
  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'tasks'), where('userId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return unsubscribe;
  }, [user]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTitle.trim()) return;

    const newTask: Omit<Task, 'id'> = {
      title: newTitle,
      priority: newPriority,
      status: 'todo',
      userId: user.uid,
      createdAt: Timestamp.now(),
      dueDate: newDueDate ? Timestamp.fromDate(new Date(newDueDate)) : undefined,
    };

    try {
      await addDoc(collection(db, 'tasks'), newTask);
      setIsAddModalOpen(false);
      setNewTitle('');
      setNewPriority('medium');
      setNewDueDate('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  const toggleTaskStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'todo' : 'done';
    
    if (newStatus === 'done') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4ade80', '#22c55e', '#16a34a', '#15803d']
      });
    }

    const taskRef = doc(db, 'tasks', task.id);
    
    // Optimistic UI
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t));

    try {
      await updateDoc(taskRef, { 
        status: newStatus,
        completedAt: newStatus === 'done' ? Timestamp.now() : null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${id}`);
    }
  };

  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);
  const [newSubtaskTitles, setNewSubtaskTitles] = useState<Record<string, string>>({});

  const toggleTaskExpansion = (id: string) => {
    setExpandedTasks(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const handleAddSubtask = async (e: React.FormEvent, taskId: string) => {
    e.preventDefault();
    const title = newSubtaskTitles[taskId]?.trim();
    if (!title) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const newSubtask = {
      id: crypto.randomUUID(),
      title,
      completed: false
    };

    const updatedSubtasks = [...(task.subtasks || []), newSubtask];

    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: updatedSubtasks });
      setNewSubtaskTitles(prev => ({ ...prev, [taskId]: '' }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const toggleSubtaskStatus = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.map(st => 
      st.id === subtaskId ? { ...st, completed: !st.completed } : st
    );

    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: updatedSubtasks });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const deleteSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;

    const updatedSubtasks = task.subtasks.filter(st => st.id !== subtaskId);

    try {
      await updateDoc(doc(db, 'tasks', taskId), { subtasks: updatedSubtasks });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const filteredTasks = tasks.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesDate = true;
    if (filterDate !== 'all') {
      const [type, range] = filterDate.split('_');
      const targetDate = type === 'created' ? t.createdAt?.toDate() : t.completedAt?.toDate();
      
      if (!targetDate) {
        matchesDate = false;
      } else {
        if (range === 'today') matchesDate = isToday(targetDate);
        if (range === 'week') matchesDate = isThisWeek(targetDate);
        if (range === 'month') matchesDate = isThisMonth(targetDate);
      }
    }

    return matchesStatus && matchesPriority && matchesSearch && matchesDate;
  });

  const priorityColors = {
    low: 'bg-surface-container-high text-on-surface-variant',
    medium: 'bg-primary-container text-on-primary-container',
    high: 'bg-error-container text-on-error-container',
  };

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Tasks</h1>
          <p className="text-on-surface-variant">Manage your daily to-do list and subtasks.</p>
        </div>
        <button 
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center justify-center gap-2 bg-primary hover:opacity-90 text-on-primary px-6 py-3 rounded-2xl font-black transition-all shadow-lg shadow-primary/20 uppercase tracking-widest text-xs"
        >
          <Plus size={20} />
          Add Task
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-surface-container-lowest p-4 rounded-3xl border border-outline-variant/20 shadow-sm">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={18} />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            className="w-full pl-12 pr-4 py-3 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-on-surface placeholder:text-on-surface-variant"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select 
            className="bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary text-on-surface"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="done">Done</option>
          </select>
          <select 
            className="bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary text-on-surface"
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
          >
            <option value="all">All Priority</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <select 
            className="bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm font-bold focus:ring-2 focus:ring-primary text-on-surface"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          >
            <option value="all">All Dates</option>
            <option value="created_today">Created Today</option>
            <option value="created_week">Created This Week</option>
            <option value="created_month">Created This Month</option>
            <option value="completed_today">Completed Today</option>
            <option value="completed_week">Completed This Week</option>
            <option value="completed_month">Completed This Month</option>
          </select>
        </div>
      </div>

      {/* Tasks List */}
      <div className="grid grid-cols-1 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredTasks.length > 0 ? (
            filteredTasks.map(task => (
              <motion.div 
                layout
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                key={task.id} 
                className={cn(
                  "group bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/20 shadow-sm flex flex-col gap-4 transition-all hover:shadow-md",
                  task.status === 'done' && "opacity-60 scale-[0.98]"
                )}
              >
                <div className="flex items-center gap-4 w-full">
                  <button 
                    onClick={() => toggleTaskStatus(task)}
                    className="text-outline-variant hover:text-primary transition-colors relative shrink-0"
                  >
                    <AnimatePresence mode="wait">
                      {task.status === 'done' ? (
                        <motion.div
                          key="done"
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: 90 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <CheckCircle2 size={28} className="text-primary" />
                        </motion.div>
                      ) : (
                        <motion.div
                          key="todo"
                          initial={{ scale: 0, rotate: 90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          exit={{ scale: 0, rotate: -90 }}
                          transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        >
                          <Circle size={28} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                  
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => toggleTaskExpansion(task.id)}>
                    <h3 className={cn(
                      "font-bold text-lg truncate text-on-surface transition-all duration-300",
                      task.status === 'done' && "line-through text-on-surface-variant"
                    )}>
                      {task.title}
                    </h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={cn("text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full", priorityColors[task.priority])}>
                        {task.priority}
                      </span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1 text-xs text-on-surface-variant">
                          <Clock size={12} />
                          {format(task.dueDate.toDate(), 'MMM d, h:mm a')}
                        </span>
                      )}
                      {task.subtasks && task.subtasks.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-on-surface-variant font-medium">
                          <CheckSquare size={12} />
                          {task.subtasks.filter(st => st.completed).length}/{task.subtasks.length}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button 
                      onClick={() => toggleTaskExpansion(task.id)}
                      className="p-2 text-on-surface-variant hover:text-primary hover:bg-primary-container/10 rounded-xl transition-all"
                    >
                      <ChevronDown size={18} className={cn("transition-transform", expandedTasks.includes(task.id) && "rotate-180")} />
                    </button>
                    <button 
                      onClick={() => deleteTask(task.id)}
                      className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/10 rounded-xl transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Subtasks Section */}
                <AnimatePresence>
                  {expandedTasks.includes(task.id) && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden w-full"
                    >
                      <div className="pl-11 pr-2 pb-2 space-y-3 pt-2 border-t border-outline-variant/10">
                        {task.subtasks?.map(subtask => (
                          <div key={subtask.id} className="flex items-center gap-3 group/subtask">
                            <button 
                              onClick={() => toggleSubtaskStatus(task.id, subtask.id)}
                              className="text-outline-variant hover:text-primary transition-colors"
                            >
                              {subtask.completed ? <CheckCircle2 size={20} className="text-primary" /> : <Circle size={20} />}
                            </button>
                            <span className={cn(
                              "flex-1 text-sm font-medium transition-all",
                              subtask.completed ? "line-through text-on-surface-variant" : "text-on-surface"
                            )}>
                              {subtask.title}
                            </span>
                            <button 
                              onClick={() => deleteSubtask(task.id, subtask.id)}
                              className="opacity-0 group-hover/subtask:opacity-100 p-1.5 text-on-surface-variant hover:text-error hover:bg-error-container/10 rounded-lg transition-all"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        
                        <form onSubmit={(e) => handleAddSubtask(e, task.id)} className="flex items-center gap-3 mt-2">
                          <div className="w-5 flex justify-center text-outline-variant/50">
                            <Plus size={16} />
                          </div>
                          <input 
                            type="text"
                            placeholder="Add a subtask..."
                            value={newSubtaskTitles[task.id] || ''}
                            onChange={(e) => setNewSubtaskTitles(prev => ({ ...prev, [task.id]: e.target.value }))}
                            className="flex-1 bg-transparent border-none text-sm focus:ring-0 p-0 text-on-surface placeholder:text-on-surface-variant/50 font-medium"
                          />
                        </form>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20 bg-surface-container-lowest rounded-[2.5rem] border border-dashed border-outline-variant/30"
            >
              <div className="w-16 h-16 bg-surface-container-low text-on-surface-variant rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckSquare size={32} />
              </div>
              <p className="text-on-surface-variant font-medium">No tasks found matching your filters.</p>
              <button 
                onClick={() => setIsAddModalOpen(true)}
                className="mt-4 text-primary font-black uppercase tracking-widest text-xs hover:underline"
              >
                Create your first task
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Add Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-inverse-surface/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-lg rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-on-surface">New Task</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="p-2 text-on-surface-variant hover:bg-surface-container rounded-full">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddTask} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Title</label>
                <input 
                  autoFocus
                  type="text" 
                  required
                  placeholder="What needs to be done?" 
                  className="w-full px-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all text-lg font-bold text-on-surface placeholder:text-on-surface-variant"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Priority</label>
                  <select 
                    className="w-full px-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-on-surface"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as any)}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Due Date</label>
                  <input 
                    type="datetime-local" 
                    className="w-full px-6 py-4 bg-surface-container-low border-none rounded-2xl focus:ring-2 focus:ring-primary transition-all font-bold text-on-surface"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-primary hover:opacity-90 text-on-primary py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all mt-4 uppercase tracking-widest"
              >
                Create Task
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
