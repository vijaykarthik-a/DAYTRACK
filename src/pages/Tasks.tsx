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
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Tasks: React.FC = () => {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
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

  const filteredTasks = tasks.filter(t => {
    const matchesStatus = filterStatus === 'all' || t.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || t.priority === filterPriority;
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesPriority && matchesSearch;
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
        <div className="flex gap-2">
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
        </div>
      </div>

      {/* Tasks List */}
      <div className="grid grid-cols-1 gap-4">
        {filteredTasks.length > 0 ? (
          filteredTasks.map(task => (
            <div 
              key={task.id} 
              className={cn(
                "group bg-surface-container-lowest p-5 rounded-3xl border border-outline-variant/20 shadow-sm flex items-center gap-4 transition-all hover:shadow-md",
                task.status === 'done' && "opacity-60"
              )}
            >
              <button 
                onClick={() => toggleTaskStatus(task)}
                className="text-outline-variant hover:text-primary transition-colors"
              >
                {task.status === 'done' ? (
                  <CheckCircle2 size={28} className="text-primary" />
                ) : (
                  <Circle size={28} />
                )}
              </button>
              
              <div className="flex-1 min-w-0">
                <h3 className={cn(
                  "font-bold text-lg truncate text-on-surface",
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
                </div>
              </div>

              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="p-2 text-on-surface-variant hover:text-error hover:bg-error-container/10 rounded-xl transition-all"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 bg-surface-container-lowest rounded-[2.5rem] border border-dashed border-outline-variant/30">
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
          </div>
        )}
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
