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
  Star
} from 'lucide-react';
import { format } from 'date-fns';
import { db, collection, query, where, onSnapshot, Timestamp } from '../firebase';
import { Task, Routine, RoutineLog } from '../types';
import { Link } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Dashboard: React.FC = () => {
  const { profile, user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>([]);

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

    const unsubTasks = onSnapshot(tasksQuery, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    });

    const unsubRoutines = onSnapshot(routinesQuery, (snapshot) => {
      setRoutines(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Routine)));
    });

    const unsubLogs = onSnapshot(logsQuery, (snapshot) => {
      setRoutineLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RoutineLog)));
    });

    return () => {
      unsubTasks();
      unsubRoutines();
      unsubLogs();
    };
  }, [user]);

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

  return (
    <div className="space-y-10 pb-20 md:pb-10">
      {/* Header & Clock */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-stone-400 font-bold text-xs uppercase tracking-widest mb-2">
            {format(currentTime, 'EEEE, MMMM do')}
          </h2>
          <h1 className="text-4xl font-bold tracking-tight text-stone-900">
            Hey, {profile?.displayName.split(' ')[0] || 'User'}
          </h1>
        </div>
        <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-stone-100 flex items-center gap-4">
          <Clock className="text-orange-500" size={24} />
          <div className="flex flex-col">
            <p className="text-3xl font-semibold tracking-tight text-stone-900 leading-none flex items-baseline gap-1">
              {format(currentTime, 'h:mm')}
              <span className="text-xl text-stone-400 font-medium">{format(currentTime, ':ss a')}</span>
            </p>
            <p className="text-xs font-medium text-stone-400 mt-1">Live Time</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Stats & Progress */}
        <div className="lg:col-span-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Task Progress Card */}
            <div className="bg-stone-900 rounded-3xl p-8 text-white shadow-md relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
                <CheckSquare size={120} />
              </div>
              <div className="relative z-10">
                <h3 className="text-stone-400 font-semibold text-xs uppercase tracking-wider mb-8 flex items-center gap-2">
                  <TrendingUp size={14} className="text-orange-500" />
                  Daily Velocity
                </h3>
                <div className="flex items-end gap-4 mb-6">
                  <p className="text-6xl font-bold tracking-tight">
                    {completedTasks}<span className="text-stone-600 text-3xl">/{todayTasks.length}</span>
                  </p>
                </div>
                <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-orange-600 transition-all duration-1000 ease-out"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
                <p className="text-stone-400 text-sm font-medium">
                  {remainingTasks === 0 && todayTasks.length > 0 
                    ? "Peak performance achieved." 
                    : `${remainingTasks} objectives remaining.`}
                </p>
              </div>
            </div>

            {/* Routine Progress Card */}
            <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:scale-110 transition-transform duration-500">
                <Repeat size={120} />
              </div>
              <div className="relative z-10">
                <h3 className="text-stone-400 font-semibold text-xs uppercase tracking-wider mb-8 flex items-center gap-2">
                  <Star size={14} className="text-orange-500" />
                  Consistency Flow
                </h3>
                <div className="flex items-end gap-4 mb-6">
                  <p className="text-6xl font-bold tracking-tight text-stone-900">
                    {completedRoutines}<span className="text-stone-300 text-3xl">/{todayRoutines.length}</span>
                  </p>
                </div>
                <div className="w-full h-3 bg-stone-50 rounded-full overflow-hidden mb-4">
                  <div 
                    className="h-full bg-orange-600 transition-all duration-1000 ease-out"
                    style={{ width: `${routineProgress}%` }}
                  />
                </div>
                <p className="text-stone-400 text-sm font-medium">
                  {routineProgress === 100 ? "Flow state maintained." : "Keep the momentum going."}
                </p>
              </div>
            </div>
          </div>

          {/* Next Objective Card */}
          <div className="bg-orange-50 rounded-3xl p-8 border border-orange-100 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 bg-orange-600 rounded-2xl flex items-center justify-center text-white shadow-md shadow-orange-200">
                  <Zap size={28} fill="currentColor" />
                </div>
                <div>
                  <h3 className="text-stone-500 font-semibold text-xs uppercase tracking-wider mb-1">Next Objective</h3>
                  <p className="text-xl font-bold text-stone-900">
                    {nextTask ? nextTask.title : "No pending tasks"}
                  </p>
                  <p className="text-orange-600 font-medium text-sm mt-1">
                    {nextTask ? `Priority: ${nextTask.priority}` : "Enjoy your free time!"}
                  </p>
                </div>
              </div>
              <Link to="/tasks" className="bg-stone-900 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-stone-800 transition-all shadow-md">
                Execute <ChevronRight size={20} />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Quick Actions & Focus */}
        <div className="lg:col-span-4 space-y-8">
          {/* Focus Mode Card */}
          <div className="bg-stone-950 rounded-3xl p-8 text-white shadow-lg flex flex-col justify-between min-h-[280px] relative overflow-hidden">
            <div className="absolute -bottom-10 -right-10 opacity-10">
              <Timer size={200} />
            </div>
            <div className="relative z-10">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-8">
                <Timer size={24} className="text-orange-500" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight mb-3">Focus Zone</h3>
              <p className="text-stone-400 font-medium leading-relaxed mb-8">
                Eliminate distractions and enter deep work mode.
              </p>
            </div>
            <Link to="/focus" className="relative z-10 flex items-center gap-2 bg-orange-600 hover:bg-orange-500 transition-all py-4 px-6 rounded-xl font-semibold w-full justify-center shadow-md">
              <Play size={20} fill="currentColor" className="ml-1" />
              Enter Focus
            </Link>
          </div>

          {/* Quick Routine List */}
          <div className="bg-white rounded-3xl p-8 border border-stone-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-stone-900 font-bold flex items-center gap-2">
                <Repeat size={18} className="text-orange-600" />
                Checklist
              </h3>
              <Link to="/routines" className="text-stone-300 hover:text-stone-900 transition-colors">
                <ChevronRight size={20} />
              </Link>
            </div>
            <div className="space-y-4">
              {todayRoutines.slice(0, 4).map(routine => {
                const isDone = routineLogs.some(log => log.routineId === routine.id && log.done);
                return (
                  <div key={routine.id} className="flex items-center gap-4 p-4 rounded-2xl bg-stone-50 border border-stone-100 group hover:bg-white hover:shadow-md transition-all cursor-pointer">
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                      isDone ? "bg-orange-600 border-orange-600" : "border-stone-200 group-hover:border-orange-400"
                    )}>
                      {isDone && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <span className={cn(
                      "flex-1 text-sm font-semibold transition-all",
                      isDone ? "text-stone-400 line-through" : "text-stone-700"
                    )}>
                      {routine.title}
                    </span>
                  </div>
                );
              })}
              {todayRoutines.length === 0 && (
                <p className="text-stone-400 text-sm font-bold italic text-center py-4">No routines today.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
