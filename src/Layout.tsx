import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Logo } from './components/Logo';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AVAILABLE_MODULES = [
  { id: 'tasks', name: 'Tasks', icon: 'check_circle', description: 'Manage your to-dos and projects' },
  { id: 'calendar', name: 'Calendar', icon: 'calendar_today', description: 'Schedule events and sync with Google' },
  { id: 'focus', name: 'Focus', icon: 'timer', description: 'Pomodoro timer for deep work' },
  { id: 'routines', name: 'Routines', icon: 'repeat', description: 'Build daily habits' },
  { id: 'tracker', name: 'Tracker', icon: 'analytics', description: 'Track custom metrics over time' },
  { id: 'study', name: 'Study', icon: 'school', description: 'Organize subjects and notes' },
  { id: 'diet', name: 'Diet', icon: 'restaurant', description: 'Track calories and get AI diet advice' },
  { id: 'journal', name: 'Journal', icon: 'book', description: 'Capture your thoughts and reflections daily' },
];

const OnboardingModal: React.FC<{ onComplete: (modules: string[]) => void, initialSelected?: string[], onClose?: () => void }> = ({ onComplete, initialSelected, onClose }) => {
  const [selected, setSelected] = useState<string[]>(initialSelected || ['tasks', 'calendar']);

  const toggleModule = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 bg-inverse-surface/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 md:p-6">
      <div className="bg-surface-container-lowest w-full max-w-2xl rounded-[2.5rem] shadow-2xl p-8 animate-in fade-in zoom-in duration-300 relative">
        {onClose && (
          <button onClick={onClose} className="absolute top-6 right-6 p-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-black text-on-surface mb-2">{onClose ? 'Preferences' : 'Welcome to DailyFlow'}</h2>
          <p className="text-on-surface-variant">Personalize your experience. Select the modules you need.</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-[50vh] overflow-y-auto pr-2 dark-scrollbar">
          {AVAILABLE_MODULES.map(mod => {
            const isSelected = selected.includes(mod.id);
            return (
              <div 
                key={mod.id}
                onClick={() => toggleModule(mod.id)}
                className={`p-4 rounded-2xl border-2 cursor-pointer transition-all flex items-start gap-4 ${
                  isSelected 
                    ? 'border-primary bg-primary-container/20' 
                    : 'border-outline-variant/20 bg-surface-container-low hover:border-outline-variant/50'
                }`}
              >
                <div className={`p-3 rounded-xl ${isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                  <span className="material-symbols-outlined">{mod.icon}</span>
                </div>
                <div>
                  <h3 className={`font-bold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{mod.name}</h3>
                  <p className="text-xs text-on-surface-variant mt-1">{mod.description}</p>
                </div>
              </div>
            );
          })}
        </div>
        
        <button 
          onClick={() => onComplete(selected)}
          disabled={selected.length === 0}
          className="w-full bg-primary hover:opacity-90 disabled:opacity-50 text-on-primary py-4 rounded-2xl font-black text-lg shadow-lg shadow-primary/20 transition-all uppercase tracking-widest"
        >
          {selected.length === 0 ? 'Select at least one' : 'Continue'}
        </button>
      </div>
    </div>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout, updateProfileData } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isPreferencesOpen, setIsPreferencesOpen] = React.useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const allNavItems = [
    { id: 'dashboard', name: 'Dashboard', path: '/', icon: 'dashboard' },
    { id: 'tasks', name: 'Tasks', path: '/tasks', icon: 'check_circle' },
    { id: 'calendar', name: 'Calendar', path: '/calendar', icon: 'calendar_today' },
    { id: 'focus', name: 'Focus', path: '/focus', icon: 'timer' },
    { id: 'routines', name: 'Routines', path: '/routines', icon: 'repeat' },
    { id: 'tracker', name: 'Tracker', path: '/tracker', icon: 'analytics' },
    { id: 'study', name: 'Study', path: '/study', icon: 'school' },
    { id: 'diet', name: 'Diet', path: '/diet', icon: 'restaurant' },
    { id: 'journal', name: 'Journal', path: '/journal', icon: 'book' },
  ];

  const enabledModules = profile?.enabledModules;
  const showOnboarding = profile && !enabledModules;

  const navItems = allNavItems.filter(item => 
    item.id === 'dashboard' || (enabledModules && enabledModules.includes(item.id))
  );

  // Redirect if trying to access a disabled module
  useEffect(() => {
    if (enabledModules && location.pathname !== '/') {
      const currentModule = allNavItems.find(item => item.path === location.pathname);
      if (currentModule && currentModule.id !== 'dashboard' && !enabledModules.includes(currentModule.id)) {
        navigate('/');
      }
    }
  }, [location.pathname, enabledModules, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleOnboardingComplete = async (modules: string[]) => {
    await updateProfileData({ enabledModules: modules });
    setIsPreferencesOpen(false);
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col md:flex-row font-body selection:bg-primary-container selection:text-on-primary-container transition-colors duration-500">
      {showOnboarding && <OnboardingModal onComplete={handleOnboardingComplete} />}
      {isPreferencesOpen && <OnboardingModal onComplete={handleOnboardingComplete} initialSelected={enabledModules} onClose={() => setIsPreferencesOpen(false)} />}
      
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-container-lowest border-r border-outline-variant/20 h-screen fixed left-0 top-0 p-4 overflow-y-auto z-50 dark-scrollbar transition-colors duration-500">
        <div className="mb-8 px-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-10 h-10 text-on-surface" />
            <div className="flex flex-col">
              <span className="text-xl font-black text-on-surface tracking-tighter font-headline leading-none">DailyFlow</span>
              <span className="text-[10px] font-bold text-on-surface-variant tracking-widest uppercase mt-1">In Sync With Your Day</span>
            </div>
          </div>
          <button onClick={toggleTheme} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
        </div>
        
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 font-headline font-bold text-sm tracking-tight",
                isActive 
                  ? "bg-primary-container/30 text-primary" 
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              )}
            >
              {({ isActive }) => (
                <>
                  <span className={cn("material-symbols-outlined", isActive && "filled")}>{item.icon}</span>
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto pt-4 border-t border-outline-variant/20 space-y-1">
          <button 
            onClick={() => setIsPreferencesOpen(true)}
            className="flex items-center gap-3 w-full px-4 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors duration-200 font-headline font-bold text-sm tracking-tight text-left"
          >
            <span className="material-symbols-outlined">settings</span>
            <span>Preferences</span>
          </button>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-on-surface-variant hover:text-error hover:bg-error-container/10 rounded-lg transition-colors duration-200 font-headline font-bold text-sm tracking-tight text-left"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </button>
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full bg-surface-container-highest overflow-hidden">
              <img 
                src={profile?.avatarUrl || `https://picsum.photos/seed/${profile?.displayName}/100/100`} 
                alt="User" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-headline font-bold text-sm tracking-tight text-on-surface truncate max-w-[120px]">{profile?.displayName}</span>
              <span className="text-[10px] text-on-surface-variant font-medium">Pro Member</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-surface-container-lowest border-b border-outline-variant/20 p-4 flex items-center justify-between sticky top-0 z-50 transition-colors duration-500">
        <div className="flex items-center gap-2">
          <Logo className="w-8 h-8 text-on-surface" />
          <div className="flex flex-col">
            <span className="text-lg font-black text-on-surface tracking-tighter font-headline leading-none">DailyFlow</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">{theme === 'dark' ? 'light_mode' : 'dark_mode'}</span>
          </button>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-on-surface-variant hover:text-on-surface"
          >
            <span className="material-symbols-outlined">{isMobileMenuOpen ? 'close' : 'menu'}</span>
          </button>
        </div>
      </header>

      {/* Mobile Nav Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-surface-container-lowest z-40 pt-20 px-6 transition-colors duration-500">
          <nav className="space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) => cn(
                  "flex items-center gap-4 py-4 text-lg rounded-xl px-4 font-headline font-bold",
                  isActive ? "bg-primary-container/30 text-primary" : "text-on-surface-variant"
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("material-symbols-outlined text-2xl", isActive && "filled")}>{item.icon}</span>
                    {item.name}
                  </>
                )}
              </NavLink>
            ))}
            <button 
              onClick={() => {
                setIsPreferencesOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-4 py-4 text-lg text-on-surface-variant px-4 w-full text-left font-headline font-bold mt-4"
            >
              <span className="material-symbols-outlined text-2xl">settings</span>
              Preferences
            </button>
            <button 
              onClick={handleLogout}
              className="flex items-center gap-4 py-4 text-lg text-error px-4 w-full text-left font-headline font-bold mt-4"
            >
              <span className="material-symbols-outlined text-2xl">logout</span>
              Logout
            </button>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 md:ml-64 p-4 md:p-8 min-h-screen relative overflow-hidden transition-colors duration-500">
        {children}
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/20 px-2 py-3 flex overflow-x-auto hide-scrollbar gap-2 z-50 transition-colors duration-500">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors min-w-[64px] flex-shrink-0",
              isActive ? "text-primary" : "text-on-surface-variant"
            )}
          >
            {({ isActive }) => (
              <>
                <span className={cn("material-symbols-outlined", isActive && "filled")}>{item.icon}</span>
                <span className="text-[10px] font-bold uppercase">{item.name}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default Layout;
