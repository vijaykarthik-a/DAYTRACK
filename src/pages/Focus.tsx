import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  Music, 
  X,
  Volume2,
  VolumeX,
  Bell,
  Vibrate,
  Moon,
  Zap,
  ChevronRight
} from 'lucide-react';
import { db, collection, addDoc, Timestamp, handleFirestoreError, OperationType } from '../firebase';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const STATIONS = [
  { id: 'jfKfPfyJRdk', name: 'Lofi Girl' },
  { id: '5yx6BWlEVcY', name: 'Chillhop' },
  { id: 'mPZkdNFkNps', name: 'Nature Sounds' },
  { id: '4xDzrJKXOOY', name: 'Synthwave' },
];

const Focus: React.FC = () => {
  const { user } = useAuth();
  const [mode, setMode] = useState<'pomodoro' | 'break' | 'custom'>('pomodoro');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMusic, setShowMusic] = useState(false);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(25);
  const [currentStation, setCurrentStation] = useState(STATIONS[0]);
  
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const initialTimeRef = useRef<number>(25 * 60);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      initialTimeRef.current = timeLeft;
      
      timerRef.current = setInterval(() => {
        const delta = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
        const nextTime = Math.max(0, initialTimeRef.current - delta);
        setTimeLeft(nextTime);
        
        if (nextTime === 0) {
          handleTimerComplete();
        }
      }, 100);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive]);

  const handleTimerComplete = async () => {
    setIsActive(false);
    if (user && (mode === 'pomodoro' || mode === 'custom')) {
      try {
        await addDoc(collection(db, 'focus_sessions'), {
          sessionType: mode,
          durationMin: Math.floor(initialTimeRef.current / 60),
          startedAt: Timestamp.now(),
          completed: true,
          userId: user.uid
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'focus_sessions');
      }
    }
    
    if (mode === 'pomodoro') {
      setMode('break');
      setTimeLeft(5 * 60);
    } else if (mode === 'break') {
      setMode('pomodoro');
      setTimeLeft(25 * 60);
    }
    
    const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-alarm-digital-clock-beep-989.mp3');
    audio.play();
  };

  const startFocus = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    }
    setIsActive(true);
  };

  const toggleTimer = () => {
    if (!isActive) {
      startFocus();
    } else {
      setIsActive(false);
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    if (mode === 'pomodoro') setTimeLeft(25 * 60);
    else if (mode === 'break') setTimeLeft(5 * 60);
    else setTimeLeft(customMinutes * 60);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const totalTime = mode === 'pomodoro' ? 25 * 60 : mode === 'break' ? 5 * 60 : customMinutes * 60;
  const progress = (timeLeft / totalTime) * 100;

  return (
    <div className={cn(
      "min-h-screen transition-all duration-700 flex flex-col",
      isFullscreen ? "bg-stone-950 text-white p-10 fixed inset-0 z-[200]" : "bg-stone-50"
    )}>
      <div className={cn(
        "max-w-7xl mx-auto w-full flex-1 flex flex-col",
        isFullscreen ? "justify-center" : "py-10"
      )}>
        {!isFullscreen && (
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-black tracking-tight text-stone-900">Focus & Flow</h1>
              <p className="text-stone-400 font-bold text-xs uppercase tracking-widest mt-1">Deep Work Hub</p>
            </div>
            <div className="flex bg-white p-1 rounded-2xl border border-stone-100 shadow-sm">
              <button className="px-6 py-2 rounded-xl text-sm font-bold bg-stone-50 text-stone-900">Active</button>
              <button className="px-6 py-2 rounded-xl text-sm font-bold text-stone-400 hover:text-stone-600">History</button>
            </div>
          </div>
        )}

        <div className={cn(
          "grid gap-10",
          isFullscreen ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"
        )}>
          {/* Main Timer Area */}
          <div className={cn(
            "flex flex-col items-center justify-center",
            isFullscreen ? "lg:col-span-12" : "lg:col-span-8 bg-white rounded-[3rem] p-12 border border-stone-100 shadow-sm"
          )}>
            {!isFullscreen && (
              <div className="w-full mb-12">
                <h3 className="text-xl font-black text-stone-800 mb-6">Current Focus</h3>
                <div className="flex items-center justify-between p-6 bg-stone-50 rounded-[2rem] border border-stone-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center">
                      <Zap size={24} />
                    </div>
                    <div>
                      <p className="font-black text-stone-900">Deep Work Block</p>
                      <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Weekdays only</p>
                    </div>
                  </div>
                  <p className="text-xl font-mono font-black text-orange-600">09:00 AM</p>
                </div>
              </div>
            )}

            <div className="relative group">
              <div className={cn(
                "rounded-full border-8 transition-all duration-500 flex items-center justify-center relative",
                isFullscreen 
                  ? "w-[40vw] h-[40vw] border-white/5" 
                  : "w-80 h-80 border-stone-50 shadow-inner"
              )}>
                <div className={cn(
                  "font-mono font-black tracking-tighter",
                  isFullscreen ? "text-[12vw]" : "text-7xl text-stone-900"
                )}>
                  {formatTime(timeLeft)}
                </div>
                
                <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none">
                  <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke={isFullscreen ? "rgba(255,255,255,0.05)" : "#f5f5f4"}
                    strokeWidth={isFullscreen ? "4" : "8"}
                  />
                  <circle
                    cx="50%"
                    cy="50%"
                    r="48%"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth={isFullscreen ? "4" : "8"}
                    strokeDasharray="100 100"
                    strokeDashoffset={100 - progress}
                    strokeLinecap="round"
                    className="transition-all duration-1000"
                    pathLength="100"
                  />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-8 mt-12">
              <button onClick={resetTimer} className={cn("p-5 rounded-full transition-all", isFullscreen ? "bg-white/10 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200")}>
                <RotateCcw size={24} />
              </button>
              <button onClick={toggleTimer} className={cn("w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-2xl", isActive ? (isFullscreen ? "bg-white/20 text-white" : "bg-stone-100 text-stone-900") : "bg-orange-700 text-white hover:scale-105 shadow-orange-200")}>
                {isActive ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" className="ml-2" />}
              </button>
              <button onClick={toggleFullscreen} className={cn("p-5 rounded-full transition-all", isFullscreen ? "bg-white/10 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200")}>
                {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
              </button>
            </div>
          </div>

          {!isFullscreen && (
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-white rounded-[3rem] p-8 border border-stone-100 shadow-sm text-center">
                <h3 className="text-lg font-black text-stone-800 mb-6">Session Picker</h3>
                <div className="relative w-48 h-48 mx-auto mb-6 bg-stone-50 rounded-full border-4 border-white shadow-lg flex items-center justify-center">
                  {[12, 3, 6, 9].map((num) => (
                    <span key={num} className="absolute font-black text-stone-300 text-sm" style={{ top: num === 12 ? '10%' : num === 6 ? '80%' : '45%', left: num === 9 ? '10%' : num === 3 ? '80%' : '45%' }}>{num}</span>
                  ))}
                  <div 
                    className="w-1 h-16 bg-orange-600 rounded-full origin-bottom -translate-y-8 transition-transform duration-500" 
                    style={{ transform: `translateY(-2rem) rotate(${mode === 'pomodoro' ? 45 : mode === 'break' ? 135 : 225}deg)` }}
                  />
                  <div className="w-2 h-2 bg-orange-600 rounded-full z-10 absolute" />
                </div>
                
                <div className="flex justify-center gap-2 mb-6">
                  <button 
                    onClick={() => { setMode('pomodoro'); setTimeLeft(25 * 60); setIsActive(false); }}
                    className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", mode === 'pomodoro' ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200")}
                  >
                    Pomodoro (25m)
                  </button>
                  <button 
                    onClick={() => { setMode('break'); setTimeLeft(5 * 60); setIsActive(false); }}
                    className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", mode === 'break' ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200")}
                  >
                    Break (5m)
                  </button>
                  <button 
                    onClick={() => { setMode('custom'); setTimeLeft(customMinutes * 60); setIsActive(false); }}
                    className={cn("px-4 py-2 rounded-xl text-xs font-bold transition-all", mode === 'custom' ? "bg-orange-600 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200")}
                  >
                    Custom
                  </button>
                </div>
                
                {mode === 'custom' && (
                  <div className="mb-6 flex items-center justify-center gap-2">
                    <input 
                      type="number" 
                      min="1" 
                      max="120" 
                      value={customMinutes} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 25;
                        setCustomMinutes(val);
                        setTimeLeft(val * 60);
                      }}
                      className="w-16 text-center bg-stone-50 border-none rounded-xl font-bold focus:ring-2 focus:ring-orange-500"
                    />
                    <span className="text-sm font-bold text-stone-400">minutes</span>
                  </div>
                )}

                <div className="bg-stone-50 p-4 rounded-2xl flex items-center justify-center gap-2">
                  <span className="text-3xl font-mono font-black">{formatTime(timeLeft)}</span>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-black text-stone-800">Quick Settings</h3>
                <div className="space-y-3">
                  {[
                    { icon: Bell, label: 'Alert Sound', value: 'Gentle Chime', options: ['Gentle Chime', 'Digital Beep', 'Soft Bell'] },
                    { icon: Vibrate, label: 'Vibration', value: 'Soft Haptic', options: ['Soft Haptic', 'Strong', 'None'] },
                    { icon: Moon, label: 'Snooze', value: '5 Minutes', options: ['5 Minutes', '10 Minutes', '15 Minutes'] }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-white rounded-3xl border border-stone-100 shadow-sm hover:bg-stone-50 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-stone-50 text-stone-400 rounded-xl flex items-center justify-center group-hover:text-orange-600 group-hover:bg-orange-50 transition-colors">
                          <item.icon size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-stone-900">{item.label}</p>
                          <select className="text-xs font-bold text-stone-400 bg-transparent border-none p-0 focus:ring-0 cursor-pointer outline-none">
                            {item.options.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-stone-300" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-indigo-950 rounded-[3rem] p-8 text-white shadow-xl shadow-indigo-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><Zap size={120} /></div>
                <h3 className="text-xl font-black mb-4">Smart Suggestion</h3>
                <p className="text-indigo-200 text-sm font-medium leading-relaxed mb-8">Based on your "Deep Work" schedule, would you like to set a recurring break reminder at 11:00 AM?</p>
                <button className="w-full bg-white text-indigo-950 py-4 rounded-2xl font-black hover:bg-indigo-50 transition-colors">Schedule Break</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Music Player */}
      <div className={cn(
        "fixed bottom-10 right-10 transition-all duration-500 z-[210]",
        showMusic ? "w-80 h-[26rem]" : "w-16 h-16"
      )}>
        {showMusic ? (
          <div className="bg-white rounded-[2.5rem] shadow-2xl border border-stone-100 overflow-hidden flex flex-col h-full animate-in zoom-in slide-in-from-bottom-10">
            <div className="p-4 bg-stone-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2 text-stone-900 font-black text-sm">
                <Music size={16} className="text-orange-600" />
                Focus Music
              </div>
              <button onClick={() => setShowMusic(false)} className="p-1.5 hover:bg-stone-200 rounded-xl transition-colors">
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 bg-black relative">
              <iframe 
                width="100%" 
                height="100%" 
                src={`https://www.youtube.com/embed/${currentStation.id}?autoplay=1&mute=${isMusicMuted ? 1 : 0}&controls=0&modestbranding=1&loop=1&playlist=${currentStation.id}`} 
                title={currentStation.name} 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              ></iframe>
            </div>
            
            <div className="p-4 bg-white flex flex-col gap-3">
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {STATIONS.map((station) => (
                  <button
                    key={station.id}
                    onClick={() => setCurrentStation(station)}
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      currentStation.id === station.id 
                        ? "bg-orange-600 text-white" 
                        : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                    )}
                  >
                    {station.name}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center border-t border-stone-100 pt-3">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider truncate max-w-[180px]">
                  Now Playing: {currentStation.name}
                </span>
                <button 
                  onClick={() => setIsMusicMuted(!isMusicMuted)} 
                  className="flex items-center gap-2 text-xs font-black text-stone-400 hover:text-orange-600 transition-colors"
                >
                  {isMusicMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowMusic(true)} 
            className={cn(
              "w-full h-full rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110",
              isFullscreen ? "bg-white/10 text-white backdrop-blur-md" : "bg-orange-600 text-white hover:bg-orange-500"
            )}
          >
            <Music size={28} />
          </button>
        )}
      </div>
    </div>
  );
};

export default Focus;
