import { useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CheckCheck,
  Flag,
  Info,
  X,
} from 'lucide-react';
import type { Bus, NotificationItem } from '../types/database';
import {
  formatClockTime,
  formatTimeAgo,
  isEmergencyNotification,
} from '../lib/supabase';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  alert_type: 'info' | 'warning' | 'arrival';
  busNumber?: string;
  created_at: string;
}

interface ToastStackProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

function AlertBadge({
  alertType,
  emergency,
}: {
  alertType: 'info' | 'warning' | 'arrival';
  emergency: boolean;
}) {
  if (emergency) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-300 bg-rose-500/20 border border-rose-500/40 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
        <AlertOctagon className="w-3 h-3" />
        <span>Emergency</span>
      </span>
    );
  }
  if (alertType === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/35 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
        <AlertTriangle className="w-3 h-3" />
        <span>Delay / Warning</span>
      </span>
    );
  }
  if (alertType === 'arrival') {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 bg-sky-500/15 border border-sky-500/35 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
        <Flag className="w-3 h-3" />
        <span>Arrival</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/35 px-2 py-0.5 rounded-md whitespace-nowrap shrink-0">
      <Info className="w-3 h-3" />
      <span>Live Update</span>
    </span>
  );
}

export function ToastStack({ toasts, onDismiss }: ToastStackProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-20 right-4 sm:right-6 z-50 flex flex-col gap-3 w-[calc(100vw-2rem)] sm:w-96 pointer-events-none"
    >
      {toasts.map((toast) => {
        const emergency = isEmergencyNotification(toast.title, toast.message);
        const borderClass = emergency
          ? 'border-rose-500/60 bg-[#1B0D14]'
          : toast.alert_type === 'warning'
          ? 'border-amber-500/50 bg-[#17140E]'
          : toast.alert_type === 'arrival'
          ? 'border-sky-500/50 bg-[#0E1722]'
          : 'border-slate-700 bg-[#111827]';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-xl border p-4 shadow-2xl shadow-black/50 backdrop-blur-md transition-all ${borderClass}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <AlertBadge alertType={toast.alert_type} emergency={emergency} />
                {toast.busNumber && (
                  <span className="font-mono text-[11px] text-slate-400">
                    {toast.busNumber}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                aria-label="Dismiss notification"
                className="p-1 text-slate-400 hover:text-white rounded-md transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <h3 className="font-display text-sm font-semibold text-white mt-2">
              {toast.title}
            </h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              {toast.message}
            </p>
            <div className="text-[11px] font-mono text-slate-500 mt-2">
              {formatClockTime(toast.created_at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  buses: Bus[];
  selectedBusId: string | null;
  unreadIds: Set<string>;
  onMarkAllRead: () => void;
}

export function NotificationDrawer({
  open,
  onClose,
  notifications,
  buses,
  selectedBusId,
  unreadIds,
  onMarkAllRead,
}: NotificationDrawerProps) {
  const [filterScope, setFilterScope] = useState<'all' | 'bus'>('all');

  if (!open) return null;

  const busMap = new Map(buses.map((b) => [b.id, b]));
  const filtered =
    filterScope === 'bus' && selectedBusId
      ? notifications.filter((n) => n.bus_id === selectedBusId)
      : notifications;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over feed panel */}
      <aside
        aria-label="Live Notifications Feed"
        className="relative z-10 w-full max-w-md bg-[#0E1422] border-l border-slate-800 h-full flex flex-col shadow-2xl"
      >
        <div className="p-5 border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Bell className="w-4.5 h-4.5 text-amber-400" />
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Live Student Alerts
              </h2>
              <p className="text-xs text-slate-400">
                Real-time notifications from campus buses
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close notifications panel"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Filter & Mark Read Bar */}
        <div className="px-5 py-3 border-b border-slate-800/80 flex items-center justify-between gap-3 bg-[#090D16]/60">
          <div className="flex items-center p-1 rounded-lg bg-[#090D16] border border-slate-800">
            <button
              type="button"
              onClick={() => setFilterScope('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterScope === 'all'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Buses
            </button>
            <button
              type="button"
              onClick={() => setFilterScope('bus')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterScope === 'bus'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active Bus
            </button>
          </div>

          {unreadIds.size > 0 && (
            <button
              type="button"
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Scrollable feed */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/70">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <Bell className="w-7 h-7 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-300">
                No alerts yet
              </p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                Live arrival notices, traffic delays, and driver announcements
                will appear here instantly.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const emergency = isEmergencyNotification(item.title, item.message);
              const bus = busMap.get(item.bus_id);
              const isUnread = unreadIds.has(item.id);

              return (
                <article
                  key={item.id}
                  className={`p-4 transition-colors ${
                    emergency
                      ? 'bg-rose-500/[0.07]'
                      : isUnread
                      ? 'bg-slate-800/35'
                      : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertBadge
                        alertType={item.alert_type}
                        emergency={emergency}
                      />
                      {bus && (
                        <span className="font-mono text-xs text-slate-400">
                          {bus.bus_number}
                        </span>
                      )}
                    </div>
                    <time
                      dateTime={item.created_at}
                      className="font-mono text-[11px] text-slate-500 whitespace-nowrap"
                    >
                      {formatClockTime(item.created_at)} ·{' '}
                      {formatTimeAgo(item.created_at)}
                    </time>
                  </div>
                  <h3 className="font-display text-sm font-semibold text-white mt-2">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {item.message}
                  </p>
                </article>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}
