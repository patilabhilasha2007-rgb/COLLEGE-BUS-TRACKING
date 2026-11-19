import { Bell, BusFront, LogOut } from 'lucide-react';
import type { Profile } from '../types/database';

export type NavSection = 'directory' | 'duty' | 'driver' | 'map' | 'timetable';

interface TopNavProps {
  profile: Profile;
  unreadCount: number;
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onToggleNotifications: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}

export function TopNav({
  profile,
  unreadCount,
  activeSection,
  onSelectSection,
  onToggleNotifications,
  onSignOut,
  signingOut,
}: TopNavProps) {
  const isDriverOrAdmin = profile.role === 'driver' || profile.role === 'admin';
  const portalLabel = isDriverOrAdmin ? 'Driver Portal' : 'Student Portal';

  const navItems: { id: NavSection; label: string }[] = isDriverOrAdmin
    ? [
        { id: 'duty', label: 'Assigned Duty' },
        { id: 'driver', label: 'Live Controls' },
        { id: 'map', label: 'Live Map' },
        { id: 'timetable', label: 'Timetable' },
      ]
    : [
        { id: 'directory', label: 'Bus Directory' },
        { id: 'map', label: 'Live Map' },
        { id: 'timetable', label: 'Timetable' },
      ];

  return (
    <header className="sticky top-0 z-30 h-16 bg-[#090D16]/95 backdrop-blur-md border-b border-slate-800/90 px-4 lg:px-6 flex items-center justify-between gap-6">
      {/* Zone 1: Brand Title */}
      <button
        type="button"
        onClick={() => onSelectSection(isDriverOrAdmin ? 'duty' : 'directory')}
        className="flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg"
      >
        <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center">
          <BusFront className="w-4.5 h-4.5" strokeWidth={2.25} />
        </div>
        <span className="font-display text-base sm:text-lg font-bold tracking-tight text-white">
          PESITM Transit
        </span>
      </button>

      {/* Zone 2: Portal Navigation Links */}
      <nav
        aria-label="Primary sections"
        className="hidden md:flex items-center gap-6 text-sm font-medium"
      >
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectSection(item.id)}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer border-b-2 ${
              activeSection === item.id
                ? 'text-white border-amber-500'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Zone 3: User Portal Context, Notification Bell & Sign Out */}
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap">
          <span className="text-slate-200 font-medium max-w-[140px] truncate">
            {profile.full_name}
          </span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-400 font-medium">{portalLabel}</span>
        </div>

        <button
          type="button"
          onClick={onToggleNotifications}
          aria-label={`Open notifications (${unreadCount} unread)`}
          className="relative p-2.5 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors cursor-pointer shrink-0"
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold flex items-center justify-center border-2 border-[#090D16]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          type="button"
          disabled={signingOut}
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#111827] hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-200 hover:text-white transition-colors whitespace-nowrap shrink-0 disabled:opacity-60 cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-slate-400" />
          <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
        </button>
      </div>
    </header>
  );
}
