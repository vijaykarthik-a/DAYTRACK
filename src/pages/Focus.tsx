import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
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
  const { theme, toggleTheme } = useTheme();
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
      "min-h-screen transition-all duration-700 flex flex-col relative",
      isFullscreen ? "bg-background text-on-background fixed inset-0 z-[200] p-10" : ""
    )}>
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 overflow-hidden opacity-20">
        <div className="absolute top-[10%] right-[5%] w-[40vw] h-[40vw] bg-primary/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[5%] left-[15%] w-[30vw] h-[30vw] bg-tertiary/10 rounded-full blur-[100px]"></div>
      </div>

      <div className={cn(
        "max-w-7xl mx-auto w-full flex-1 flex flex-col",
        isFullscreen ? "justify-center" : "py-4"
      )}>
        {!isFullscreen && (
          <div className="flex items-center justify-between mb-8">
            <h1 className="font-manrope font-extrabold text-3xl tracking-tight text-primary">Focus & Flow</h1>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-4 text-on-surface-variant">
                <button onClick={toggleTheme} className="cursor-pointer hover:text-on-surface transition-colors flex items-center">
                  <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
                </button>
                <span className="material-symbols-outlined cursor-pointer hover:text-on-surface transition-colors">search</span>
                <span className="material-symbols-outlined cursor-pointer hover:text-on-surface transition-colors">notifications</span>
              </div>
              <button 
                onClick={toggleTimer}
                className="bg-gradient-to-br from-primary to-primary-container text-on-primary px-6 py-2.5 rounded-lg font-bold text-sm shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
              >
                {isActive ? 'Pause Timer' : 'Start Timer'}
              </button>
            </div>
          </div>
        )}

        <div className={cn(
          "grid gap-8",
          isFullscreen ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-12"
        )}>
          {/* Left Column: Focus Context */}
          {!isFullscreen && (
            <div className="lg:col-span-3 space-y-6">
              <div className="bg-surface-container p-6 rounded-xl shadow-sm border border-outline-variant/20">
                <span className="text-xs font-bold text-primary uppercase tracking-widest mb-2 block">Current Focus</span>
                <h2 className="text-xl font-bold font-headline text-on-surface mb-1">Deep Work Block</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">System Architecture Design for the Q3 Enterprise Portal overhaul.</p>
                <div className="mt-4 flex items-center gap-2 text-secondary font-medium text-xs">
                  <span className="material-symbols-outlined text-sm">event_note</span>
                  <span>Productivity Project</span>
                </div>
              </div>
              
              <div className="bg-surface-container-low p-6 rounded-xl space-y-4 border border-outline-variant/10">
                <h3 className="font-headline font-bold text-sm text-on-surface">Quick Settings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/5">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">volume_up</span>
                      <span className="text-sm font-medium">Alert Sound</span>
                    </div>
                    <div className="w-8 h-4 bg-primary/20 rounded-full relative">
                      <div className="absolute right-0 top-0 w-4 h-4 bg-primary rounded-full shadow-sm"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/5">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">vibration</span>
                      <span className="text-sm font-medium">Vibration</span>
                    </div>
                    <div className="w-8 h-4 bg-surface-container-highest rounded-full relative">
                      <div className="absolute left-0 top-0 w-4 h-4 bg-outline rounded-full shadow-sm"></div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/5">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">snooze</span>
                      <span className="text-sm font-medium">Auto-Snooze</span>
                    </div>
                    <div className="w-8 h-4 bg-primary/20 rounded-full relative">
                      <div className="absolute right-0 top-0 w-4 h-4 bg-primary rounded-full shadow-sm"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Center Column: Kinetic Timer */}
          <div className={cn(
            "flex flex-col items-center justify-start py-8",
            isFullscreen ? "lg:col-span-12 justify-center" : "lg:col-span-6"
          )}>
            <div className={cn(
              "relative flex items-center justify-center rounded-full bg-surface-container-lowest timer-glow border-8 border-surface-container-low transition-all",
              isFullscreen ? "w-[40vw] h-[40vw]" : "w-80 h-80 md:w-96 md:h-96"
            )}>
              {/* Progress Ring (SVG) */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle className="text-outline/10" cx="50%" cy="50%" fill="transparent" r="48%" stroke="currentColor" strokeWidth={isFullscreen ? "4" : "8"}></circle>
                <circle 
                  className="text-primary transition-all duration-1000" 
                  cx="50%" cy="50%" fill="transparent" r="48%" stroke="currentColor" 
                  strokeDasharray="100 100" 
                  strokeDashoffset={100 - progress}
                  strokeLinecap="round" 
                  strokeWidth={isFullscreen ? "4" : "8"} 
                  pathLength="100"
                  style={{ filter: 'drop-shadow(0 0 8px rgba(255,87,34,0.5))' }}
                ></circle>
              </svg>
              <div className="text-center z-10">
                <div className={cn(
                  "font-black font-headline tracking-tighter text-on-surface leading-none",
                  isFullscreen ? "text-[12vw]" : "text-[5rem] md:text-[7rem]"
                )}>
                  {formatTime(timeLeft)}
                </div>
                <p className="text-primary font-bold tracking-[0.2em] uppercase text-sm mt-2">
                  {mode === 'pomodoro' ? 'Pomodoro Phase' : mode === 'break' ? 'Break Phase' : 'Custom Phase'}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-12 flex items-center gap-8">
              <button onClick={resetTimer} className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-outline-variant/10 transition-colors active:scale-90">
                <span className="material-symbols-outlined">refresh</span>
              </button>
              <button onClick={toggleTimer} className="w-20 h-20 flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all">
                <span className="material-symbols-outlined text-4xl filled">{isActive ? 'pause' : 'play_arrow'}</span>
              </button>
              <button onClick={toggleFullscreen} className="w-12 h-12 flex items-center justify-center rounded-full bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-outline-variant/10 transition-colors active:scale-90">
                <span className="material-symbols-outlined">{isFullscreen ? 'close_fullscreen' : 'open_in_full'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Controls & Suggestions */}
          {!isFullscreen && (
            <div className="lg:col-span-3 space-y-6">
              {/* Session Picker */}
              <div className="bg-surface-container p-6 rounded-xl shadow-sm border border-outline-variant/20">
                <h3 className="font-headline font-bold text-sm text-on-surface mb-6">Session Picker</h3>
                
                {/* Visual Clock Dial */}
                <div className="relative w-full aspect-square mb-6 flex items-center justify-center">
                  <div className="absolute inset-0 border-2 border-dashed border-outline-variant/20 rounded-full"></div>
                  <div 
                    className="w-2 h-2 bg-primary rounded-full absolute top-0 left-1/2 -translate-x-1/2 shadow-[0_0_8px_rgba(255,87,34,0.8)] transition-transform duration-500 origin-[50%_100px]"
                    style={{ transform: `translateX(-50%) rotate(${mode === 'pomodoro' ? 0 : mode === 'break' ? 72 : 216}deg)` }}
                  ></div>
                  <div 
                    className="w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent absolute top-1/2 -translate-y-1/2 transition-transform duration-500"
                    style={{ transform: `translateY(-50%) rotate(${mode === 'pomodoro' ? 45 : mode === 'break' ? 135 : 225}deg)` }}
                  ></div>
                  <div className="text-center">
                    <span className="text-2xl font-black text-on-surface">{mode === 'pomodoro' ? '25' : mode === 'break' ? '5' : customMinutes}</span>
                    <span className="text-xs block text-on-surface-variant font-bold">MINS</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <button 
                    onClick={() => { setMode('pomodoro'); setTimeLeft(25 * 60); setIsActive(false); }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg font-bold text-sm transition-colors",
                      mode === 'pomodoro' ? "bg-primary-container/40 text-on-primary border border-primary/20" : "bg-surface-container-low text-on-surface-variant font-medium border border-outline-variant/5 hover:bg-surface-container-high"
                    )}
                  >
                    <span>Pomodoro</span>
                    <span className="text-xs opacity-70">25m</span>
                  </button>
                  <button 
                    onClick={() => { setMode('break'); setTimeLeft(5 * 60); setIsActive(false); }}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg font-bold text-sm transition-colors",
                      mode === 'break' ? "bg-primary-container/40 text-on-primary border border-primary/20" : "bg-surface-container-low text-on-surface-variant font-medium border border-outline-variant/5 hover:bg-surface-container-high"
                    )}
                  >
                    <span>Short Break</span>
                    <span className="text-xs opacity-70">5m</span>
                  </button>
                  
                  {mode === 'custom' ? (
                    <div className="mt-2 flex items-center justify-center gap-2 p-3 rounded-lg border border-primary/50 text-primary font-medium text-sm">
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
                        className="w-16 text-center bg-transparent border-b border-primary/50 focus:outline-none focus:border-primary font-bold"
                      />
                      <span>mins</span>
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setMode('custom'); setTimeLeft(customMinutes * 60); setIsActive(false); }}
                      className="mt-2 flex items-center justify-center gap-2 p-3 rounded-lg border border-dashed border-outline-variant/30 text-on-surface-variant font-medium text-sm hover:border-primary/50 hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      <span>Custom Session</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Smart Suggestion Card */}
              <div className="relative overflow-hidden bg-tertiary-container text-on-tertiary-container p-6 rounded-xl shadow-lg group border border-tertiary/20">
                <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-tertiary/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-xl text-tertiary filled">auto_awesome</span>
                    <span className="text-xs font-black uppercase tracking-wider text-tertiary">Flow Insight</span>
                  </div>
                  <p className="text-sm font-medium leading-snug">
                    "You usually hit your peak focus at 11:30 AM. Ready to extend this block by 10 minutes?"
                  </p>
                  <button className="mt-4 w-full py-2 bg-tertiary text-on-tertiary-fixed font-black rounded-lg text-xs transition-transform active:scale-95">
                    Accept Suggestion
                  </button>
                </div>
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
          <div className="bg-surface-container-lowest rounded-[2.5rem] shadow-2xl border border-outline-variant/20 overflow-hidden flex flex-col h-full animate-in zoom-in slide-in-from-bottom-10">
            <div className="p-4 bg-surface-container border-b border-outline-variant/10 flex items-center justify-between">
              <div className="flex items-center gap-2 text-on-surface font-black text-sm font-headline">
                <span className="material-symbols-outlined text-primary text-lg">queue_music</span>
                Focus Music
              </div>
              <button onClick={() => setShowMusic(false)} className="p-1.5 hover:bg-surface-container-high rounded-xl transition-colors text-on-surface-variant">
                <span className="material-symbols-outlined text-lg">close</span>
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
            
            <div className="p-4 bg-surface-container-lowest flex flex-col gap-3">
              <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                {STATIONS.map((station) => (
                  <button
                    key={station.id}
                    onClick={() => setCurrentStation(station)}
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-bold transition-all font-headline",
                      currentStation.id === station.id 
                        ? "bg-primary-container/40 text-primary border border-primary/20" 
                        : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high border border-outline-variant/5"
                    )}
                  >
                    {station.name}
                  </button>
                ))}
              </div>
              <div className="flex justify-between items-center border-t border-outline-variant/10 pt-3">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider truncate max-w-[180px]">
                  Now Playing: {currentStation.name}
                </span>
                <button 
                  onClick={() => setIsMusicMuted(!isMusicMuted)} 
                  className="flex items-center gap-2 text-xs font-black text-on-surface-variant hover:text-primary transition-colors"
                >
                  <span className="material-symbols-outlined text-lg">{isMusicMuted ? 'volume_off' : 'volume_up'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button 
            onClick={() => setShowMusic(true)} 
            className={cn(
              "w-full h-full rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110",
              isFullscreen ? "bg-surface-container-highest text-on-surface backdrop-blur-md" : "bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-primary/30"
            )}
          >
            <span className="material-symbols-outlined text-3xl">music_note</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Focus;
