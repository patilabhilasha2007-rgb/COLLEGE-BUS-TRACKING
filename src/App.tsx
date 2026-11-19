import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import {
  AlertCircle,
  BusFront,
  Clock,
  Gauge,
  Loader2,
  MapPin,
  Phone,
  Radio,
  User as UserIcon,
} from 'lucide-react';
import {
  formatClockTime,
  getStopsForBus,
  supabase,
} from './lib/supabase';
import type {
  Bus,
  NotificationItem,
  Profile,
  Stop,
  UserRole,
} from './types/database';
import { AuthPage } from './components/AuthPage';
import { TopNav, type NavSection } from './components/TopNav';
import { BusMap } from './components/BusMap';
import { DriverDutyCard } from './components/DriverDutyCard';
import { DriverControlPanel } from './components/DriverControlPanel';
import { StudentRouteDirectory } from './components/StudentRouteDirectory';
import { TimetablePanel } from './components/TimetablePanel';
import {
  NotificationDrawer,
  ToastStack,
  type ToastMessage,
} from './components/NotificationDrawer';
import { StatusIndicator } from './components/StatusIndicator';

function deriveFallbackProfile(user: User): Profile {
  const meta = (user.user_metadata || {}) as Record<string, string | undefined>;
  const email = (user.email || '').toLowerCase();

  let role: UserRole = 'student';
  if (
    meta.role === 'driver' ||
    meta.role === 'admin' ||
    meta.role === 'student'
  ) {
    role = meta.role;
  } else if (email.includes('driver') || email.includes('admin')) {
    role = 'driver';
  }

  return {
    id: user.id,
    full_name:
      meta.full_name ||
      (role === 'driver' ? 'PESITM Bus Driver' : 'PESITM Student'),
    usn_or_staff_id:
      meta.usn_or_staff_id || (role === 'driver' ? 'DRV-01' : '4PM22CS001'),
    role,
  };
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demoProfile, setDemoProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const activeProfile = profile || demoProfile;
  const isAuthenticated = Boolean((session && profile) || demoProfile);

  // Core transit data from Supabase
  const [buses, setBuses] = useState<Bus[]>([]);
  const [allStops, setAllStops] = useState<Stop[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // UI selection state
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [boardingStopByBus, setBoardingStopByBus] = useState<
    Record<string, string>
  >({});
  const [activeSection, setActiveSection] = useState<NavSection>('directory');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<
    'connecting' | 'live' | 'reconnecting'
  >('connecting');

  useEffect(() => {
    const handleQuotaExceeded = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    return () => {
      window.removeEventListener('gmp-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  // Notifications & Toast state
  const [unreadIds, setUnreadIds] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const seenToastIdsRef = useRef<Set<string>>(new Set());
  const busesRef = useRef<Bus[]>([]);

  useEffect(() => {
    busesRef.current = buses;
  }, [buses]);

  const loadUserProfile = useCallback(async (user: User) => {
    const fallback = deriveFallbackProfile(user);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, usn_or_staff_id, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!error && data) {
        setProfile(data as Profile);
        return;
      }
    } catch {
      // Fallback cleanly to user metadata
    }
    setProfile(fallback);
  }, []);

  // Sync default nav highlight whenever role changes
  useEffect(() => {
    if (!activeProfile) return;
    const isDriver =
      activeProfile.role === 'driver' || activeProfile.role === 'admin';
    setActiveSection(isDriver ? 'duty' : 'directory');
  }, [activeProfile?.role]);

  // Hydrate initial session & listen to Supabase Auth state
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadUserProfile(data.session.user);
      } else {
        setProfile(null);
      }
      if (mounted) {
        setAuthReady(true);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!mounted) return;
        setSession(nextSession);
        if (nextSession?.user) {
          void loadUserProfile(nextSession.user);
        } else {
          setProfile(null);
          setDrawerOpen(false);
          setToasts([]);
          setUnreadIds(new Set());
        }
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [loadUserProfile]);

  // Toast helper with auto-dismiss and idempotency
  const pushToast = useCallback((toast: ToastMessage) => {
    if (seenToastIdsRef.current.has(toast.id)) return;
    seenToastIdsRef.current.add(toast.id);

    setToasts((prev) => [toast, ...prev].slice(0, 4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 6500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Idempotent notification ingest (used by both Realtime subscription and Driver panel writes)
  const ingestNotification = useCallback(
    (incoming: NotificationItem, showPopup: boolean) => {
      let wasAdded = false;
      setNotifications((prev) => {
        if (prev.some((item) => item.id === incoming.id)) {
          return prev;
        }
        wasAdded = true;
        return [incoming, ...prev].slice(0, 60);
      });

      if (showPopup && !seenToastIdsRef.current.has(incoming.id)) {
        const busMatch = busesRef.current.find((b) => b.id === incoming.bus_id);
        setUnreadIds((prev) => {
          const next = new Set(prev);
          next.add(incoming.id);
          return next;
        });
        pushToast({
          id: incoming.id,
          title: incoming.title,
          message: incoming.message,
          alert_type: incoming.alert_type,
          busNumber: busMatch?.bus_number,
          created_at: incoming.created_at,
        });
      } else if (wasAdded) {
        setUnreadIds((prev) => {
          const next = new Set(prev);
          next.add(incoming.id);
          return next;
        });
      }
    },
    [pushToast]
  );

  // Fetch initial buses, stops, notifications once authenticated
  const fetchTransitData = useCallback(async () => {
    setDataLoading(true);
    setDataError(null);

    try {
      const [busesRes, stopsRes, notifRes] = await Promise.all([
        supabase.from('buses').select('*').order('bus_number', { ascending: true }),
        supabase.from('stops').select('*').order('stop_order', { ascending: true }),
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (busesRes.error) throw new Error(busesRes.error.message);
      if (stopsRes.error) throw new Error(stopsRes.error.message);
      if (notifRes.error) throw new Error(notifRes.error.message);

      const loadedBuses = (busesRes.data || []) as Bus[];
      const loadedStops = (stopsRes.data || []) as Stop[];
      const loadedNotifs = (notifRes.data || []) as NotificationItem[];

      setBuses(loadedBuses);
      setAllStops(loadedStops);
      setNotifications(loadedNotifs);

      setSelectedBusId((prev) => {
        if (prev && loadedBuses.some((b) => b.id === prev)) return prev;
        return loadedBuses[0]?.id || null;
      });
    } catch (err) {
      setDataError(
        err instanceof Error
          ? err.message
          : 'Failed to load live bus data from Supabase.'
      );
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    void fetchTransitData();
  }, [isAuthenticated, fetchTransitData]);

  // Subscribe to Supabase Realtime: `buses` UPDATE and `notifications` INSERT
  useEffect(() => {
    if (!isAuthenticated) return;

    setRealtimeStatus('connecting');

    const channel = supabase
      .channel('pesitm-transit-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'buses',
        },
        (payload) => {
          const updatedBus = payload.new as Bus;
          setBuses((prev) =>
            prev.map((bus) => (bus.id === updatedBus.id ? updatedBus : bus))
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotif = payload.new as NotificationItem;
          ingestNotification(newNotif, true);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('live');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeStatus('reconnecting');
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAuthenticated, ingestNotification]);

  const selectedBus = useMemo(
    () => buses.find((b) => b.id === selectedBusId) || buses[0] || null,
    [buses, selectedBusId]
  );

  const activeStops = useMemo(() => {
    if (!selectedBus) return [];
    return getStopsForBus(selectedBus, allStops);
  }, [selectedBus, allStops]);

  const currentBoardingStopId = useMemo(() => {
    if (!selectedBus) return null;
    const saved = boardingStopByBus[selectedBus.id];
    if (saved && activeStops.some((s) => s.id === saved)) {
      return saved;
    }
    return activeStops[1]?.id || activeStops[0]?.id || null;
  }, [selectedBus, boardingStopByBus, activeStops]);

  const handleSelectBoardingStop = useCallback(
    (stopId: string) => {
      if (!selectedBus) return;
      setBoardingStopByBus((prev) => ({
        ...prev,
        [selectedBus.id]: stopId,
      }));
    },
    [selectedBus]
  );

  const handleBusUpdatedLocally = useCallback((updatedBus: Bus) => {
    setBuses((prev) =>
      prev.map((b) => (b.id === updatedBus.id ? updatedBus : b))
    );
  }, []);

  const handleNotificationInsertedLocally = useCallback(
    (inserted: NotificationItem) => {
      ingestNotification(inserted, true);
    },
    [ingestNotification]
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setProfile(null);
      setDemoProfile(null);
      setDrawerOpen(false);
      setToasts([]);
      setUnreadIds(new Set());
    } finally {
      setSigningOut(false);
    }
  }

  function handleSelectSection(section: NavSection) {
    setActiveSection(section);
    const idMap: Record<NavSection, string> = {
      directory: 'route-directory',
      duty: 'assigned-duty',
      driver: 'driver-console',
      map: 'map-section',
      timetable: 'timetable-section',
    };
    const el = document.getElementById(idMap[section]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#090D16] flex items-center justify-center text-slate-300 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
        <span className="text-sm font-medium">Loading PESITM Transit...</span>
      </div>
    );
  }

  if (!isAuthenticated || !activeProfile) {
    return (
      <AuthPage
        onAuthSuccess={() => {
          setDemoProfile(null);
        }}
        onDemoFallback={(fallbackProf) => {
          setDemoProfile(fallbackProf);
        }}
      />
    );
  }

  const isDriverOrAdmin =
    activeProfile.role === 'driver' || activeProfile.role === 'admin';
  const latestNotification = notifications[0] || null;

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      <TopNav
        profile={activeProfile}
        unreadCount={unreadIds.size}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onToggleNotifications={() => setDrawerOpen((prev) => !prev)}
        onSignOut={handleSignOut}
        signingOut={signingOut}
      />

      {/* Instant Live Toast Notifications */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {/* Slide-over Live Notification Bell Feed */}
      <NotificationDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        notifications={notifications}
        buses={buses}
        selectedBusId={selectedBus?.id || null}
        unreadIds={unreadIds}
        onMarkAllRead={() => setUnreadIds(new Set())}
      />

      {/* Error Banner if initial load fails */}
      {dataError && (
        <div className="max-w-[1440px] w-full mx-auto px-4 lg:px-6 pt-4">
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/35 flex items-center justify-between gap-4 text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{dataError}</span>
            </div>
            <button
              type="button"
              onClick={() => void fetchTransitData()}
              className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-white font-medium cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Main Workspace Canvas */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 lg:px-6 py-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Sidebar Rail: Fleet Switcher, Live Telemetry, Boarding Stop, Latest Alert */}
        <aside className="lg:col-span-4 xl:col-span-3 space-y-5">
          {/* Fleet Bus Switcher */}
          <section className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-bold text-white">
                Active Campus Buses
              </h2>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <Radio
                  className={`w-3.5 h-3.5 ${
                    realtimeStatus === 'live'
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}
                />
                <span>
                  {realtimeStatus === 'live' ? 'Realtime' : 'Syncing'}
                </span>
              </span>
            </div>

            {dataLoading && buses.length === 0 ? (
              <div className="space-y-2.5">
                <div className="h-20 rounded-xl bg-slate-800/60 animate-pulse" />
                <div className="h-20 rounded-xl bg-slate-800/60 animate-pulse" />
              </div>
            ) : (
              <div className="space-y-2" role="listbox" aria-label="Select college bus">
                {buses.map((bus) => {
                  const isSelected = selectedBus?.id === bus.id;
                  return (
                    <button
                      key={bus.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => setSelectedBusId(bus.id)}
                      className={`w-full text-left p-3.5 rounded-xl border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#172136] border-amber-500/70'
                          : 'bg-[#0C1220] border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-2 font-mono text-sm font-bold text-white">
                          <BusFront
                            className={`w-4 h-4 ${
                              isSelected ? 'text-amber-400' : 'text-slate-400'
                            }`}
                          />
                          {bus.bus_number}
                        </span>
                        <StatusIndicator status={bus.status} size="sm" />
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5 truncate">
                        {bus.route_name}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/80">
                        <span className="truncate">
                          Next:{' '}
                          <span className="text-slate-200">{bus.next_stop_name}</span>
                        </span>
                        <span className="font-mono text-amber-400 font-semibold shrink-0 ml-2">
                          {bus.status === 'Arrived'
                            ? 'Arrived'
                            : `${bus.eta_minutes} min`}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Active Bus Telemetry & Driver Details */}
          {selectedBus && (
            <section className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4 space-y-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                <div>
                  <h2 className="font-display text-sm font-bold text-white">
                    {selectedBus.bus_number} Live Telemetry
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Updated {formatClockTime(selectedBus.updated_at)}
                  </p>
                </div>
                <StatusIndicator status={selectedBus.status} size="sm" />
              </div>

              {/* 2-col metric strip */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Live ETA</span>
                  </div>
                  <div className="font-mono text-2xl font-bold text-white mt-1">
                    {selectedBus.status === 'Arrived'
                      ? '0'
                      : selectedBus.eta_minutes}
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      min
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-[#090D16] border border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Gauge className="w-3.5 h-3.5 text-sky-400" />
                    <span>Speed</span>
                  </div>
                  <div className="font-mono text-2xl font-bold text-white mt-1">
                    {selectedBus.speed_kmh}
                    <span className="text-xs font-normal text-slate-400 ml-1">
                      km/h
                    </span>
                  </div>
                </div>
              </div>

              {/* Hairline-divided key details */}
              <dl className="divide-y divide-slate-800/70 text-xs">
                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-400 inline-flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" />
                    <span>Next Stop</span>
                  </dt>
                  <dd className="font-medium text-white text-right">
                    {selectedBus.next_stop_name}
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-400 inline-flex items-center gap-1.5">
                    <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                    <span>Driver</span>
                  </dt>
                  <dd className="font-medium text-slate-200 text-right">
                    {selectedBus.driver_name}
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-400 inline-flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-500" />
                    <span>Driver Contact</span>
                  </dt>
                  <dd className="font-mono text-amber-400 text-right">
                    <a
                      href={`tel:${selectedBus.driver_phone.replace(/\s+/g, '')}`}
                      className="hover:underline"
                    >
                      {selectedBus.driver_phone}
                    </a>
                  </dd>
                </div>

                <div className="py-2.5 flex items-center justify-between gap-2">
                  <dt className="text-slate-400">GPS Coordinates</dt>
                  <dd className="font-mono text-[11px] text-slate-300">
                    {selectedBus.current_lat.toFixed(4)},{' '}
                    {selectedBus.current_lng.toFixed(4)}
                  </dd>
                </div>
              </dl>

              {/* Boarding Stop Selector (Student Portal convenience) */}
              {!isDriverOrAdmin && (
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <label
                    htmlFor="boarding-stop-select"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Your Boarding Stop
                  </label>
                  <select
                    id="boarding-stop-select"
                    value={currentBoardingStopId || ''}
                    onChange={(e) => handleSelectBoardingStop(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#090D16] border border-slate-800 text-xs font-medium text-white focus:outline-none focus:border-amber-500/70"
                  >
                    {activeStops.map((stop) => (
                      <option key={stop.id} value={stop.id}>
                        #{stop.stop_order} {stop.stop_name} ({stop.scheduled_time})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>
          )}

          {/* Compact Latest Alert Preview Card */}
          <section className="rounded-2xl bg-[#111827] border border-slate-800/90 p-4 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xs font-bold text-slate-200">
                Latest Dispatch Alert
              </h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="text-xs font-medium text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                View all ({notifications.length})
              </button>
            </div>
            {latestNotification ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-white">
                  {latestNotification.title}
                </p>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {latestNotification.message}
                </p>
                <p className="font-mono text-[11px] text-slate-500 pt-1">
                  {formatClockTime(latestNotification.created_at)}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                No alerts broadcast yet for today&apos;s shift.
              </p>
            )}
          </section>
        </aside>

        {/* Right Primary Viewport: Portal-Specific Flow */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-5">
          {/* DRIVER PORTAL TOP: Assigned Bus & Route Duty Card + Live Demo Controls right below */}
          {isDriverOrAdmin && selectedBus && (
            <>
              <DriverDutyCard
                buses={buses}
                bus={selectedBus}
                stops={activeStops}
                onSelectBus={setSelectedBusId}
              />

              <DriverControlPanel
                bus={selectedBus}
                stops={activeStops}
                onBusUpdated={handleBusUpdatedLocally}
                onNotificationInserted={handleNotificationInsertedLocally}
              />
            </>
          )}

          {/* STUDENT PORTAL TOP: Bus & Route Directory + Step-by-Step Vertical Route Path */}
          {!isDriverOrAdmin && (
            <StudentRouteDirectory
              buses={buses}
              allStops={allStops}
              selectedBus={selectedBus}
              selectedStops={activeStops}
              boardingStopId={currentBoardingStopId}
              onSelectBus={setSelectedBusId}
              onSelectBoardingStop={handleSelectBoardingStop}
            />
          )}

          {/* Interactive OpenStreetMap Live Bus Map */}
          <section id="map-section" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-white">
                  {selectedBus
                    ? `${selectedBus.bus_number} · ${selectedBus.route_name}`
                    : 'Shivamogga Live Bus Map'}
                </h2>
                <p className="text-xs text-slate-400">
                  Shivamogga, Karnataka · Live route polyline &amp; color-coded stop
                  progress pins
                </p>
              </div>
              {selectedBus && (
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <span className="font-mono text-slate-400">
                    Next:{' '}
                    <strong className="text-white">
                      {selectedBus.next_stop_name}
                    </strong>
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <StatusIndicator status={selectedBus.status} size="md" />
                </div>
              )}
            </div>

            <BusMap
              bus={selectedBus}
              stops={activeStops}
              boardingStopId={currentBoardingStopId}
              onSelectBoardingStop={handleSelectBoardingStop}
            />
          </section>

          {/* Timetable & Boarding Stop Status Table */}
          {selectedBus && (
            <TimetablePanel
              bus={selectedBus}
              stops={activeStops}
              boardingStopId={currentBoardingStopId}
              onSelectBoardingStop={handleSelectBoardingStop}
            />
          )}
        </div>
      </main>
    </div>
  );
}
