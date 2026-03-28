import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Logo } from './components/Logo';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: 'dashboard' },
    { name: 'Tasks', path: '/tasks', icon: 'check_circle' },
    { name: 'Calendar', path: '/calendar', icon: 'calendar_today' },
    { name: 'Focus', path: '/focus', icon: 'timer' },
    { name: 'Routines', path: '/routines', icon: 'repeat' },
    { name: 'Tracker', path: '/tracker', icon: 'analytics' },
    { name: 'Study', path: '/study', icon: 'school' },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background text-on-background flex flex-col md:flex-row font-body selection:bg-primary-container selection:text-on-primary-container transition-colors duration-500">
      {/* Sidebar for Desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-surface-container-lowest border-r border-outline-variant/20 h-screen fixed left-0 top-0 p-4 overflow-y-auto z-50 dark-scrollbar transition-colors duration-500">
        <div className="mb-8 px-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="w-10 h-10 text-on-surface" />
            <div className="flex flex-col">
              <span className="text-xl font-black text-on-surface tracking-tighter font-headline leading-none">DAILY</span>
              <span className="text-xl font-medium text-on-surface-variant tracking-tighter font-headline leading-none">TRACKING</span>
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
            <span className="text-lg font-black text-on-surface tracking-tighter font-headline leading-none">DAILY</span>
            <span className="text-lg font-medium text-on-surface-variant tracking-tighter font-headline leading-none">TRACKING</span>
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-container-lowest/90 backdrop-blur-xl border-t border-outline-variant/20 px-2 py-3 flex justify-around items-center z-50 transition-colors duration-500">
        {navItems.slice(0, 5).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-colors",
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
