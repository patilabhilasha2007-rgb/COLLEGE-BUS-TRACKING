import { useEffect, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BusFront,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  Loader2,
  MapPin,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Bus, Profile, UserRole } from '../types/database';
import { StatusIndicator } from './StatusIndicator';

interface AuthPageProps {
  onAuthSuccess: (portalHint?: 'student' | 'driver') => void;
  onDemoFallback: (profile: Profile) => void;
}

export function AuthPage({ onAuthSuccess, onDemoFallback }: AuthPageProps) {
  // Primary dedicated portal login tabs: Student Login vs Driver Login
  const [portalTab, setPortalTab] = useState<'student' | 'driver'>('student');
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Sign-Up fields
  const [fullName, setFullName] = useState('');
  const [usnOrStaffId, setUsnOrStaffId] = useState('');

  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Live fleet snapshot directly from Supabase
  const [fleetPreview, setFleetPreview] = useState<Bus[]>([]);

  useEffect(() => {
    let active = true;
    supabase
      .from('buses')
      .select('*')
      .order('bus_number', { ascending: true })
      .then(({ data }) => {
        if (active && data) {
          setFleetPreview(data as Bus[]);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function switchPortalTab(nextTab: 'student' | 'driver') {
    setPortalTab(nextTab);
    setErrorMessage(null);
    setInfoMessage(null);
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        if (error.message.toLowerCase().includes('email logins are disabled')) {
          setErrorMessage(
            `Email logins are currently disabled in Supabase Auth settings. Use the Quick ${
              portalTab === 'student' ? 'Student' : 'Driver'
            } Demo button below or enable Email Auth in Supabase.`
          );
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      onAuthSuccess(portalTab);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Unable to sign in. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(e: FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);

    if (!fullName.trim() || !usnOrStaffId.trim()) {
      setErrorMessage(
        portalTab === 'student'
          ? 'Please enter your full name and USN.'
          : 'Please enter your full name and Driver/Staff ID.'
      );
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }

    const assignedRole: UserRole = portalTab === 'driver' ? 'driver' : 'student';
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            usn_or_staff_id: usnOrStaffId.trim().toUpperCase(),
            role: assignedRole,
          },
        },
      });

      if (error) {
        if (
          error.message.toLowerCase().includes('email') &&
          error.message.toLowerCase().includes('disabled')
        ) {
          setErrorMessage(
            'Email sign-up is currently disabled in Supabase Auth settings. Enable the Email provider in Supabase or use the Quick Demo button.'
          );
        } else {
          setErrorMessage(error.message);
        }
        return;
      }

      if (data.session && data.user) {
        await supabase.from('profiles').upsert(
          {
            id: data.user.id,
            full_name: fullName.trim(),
            usn_or_staff_id: usnOrStaffId.trim().toUpperCase(),
            role: assignedRole,
          },
          { onConflict: 'id' }
        );
        onAuthSuccess(portalTab);
      } else {
        setInfoMessage(
          'Account created. Please confirm your email and sign in.'
        );
        setIsSignUp(false);
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Could not complete registration.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleQuickDemo(target: 'student' | 'driver') {
    setErrorMessage(null);
    setInfoMessage(null);
    setDemoLoading(true);

    const demoEmail =
      target === 'student' ? 'student@pesitm.edu' : 'driver@pesitm.edu';

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: demoEmail,
        password: '123456',
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes('email logins are disabled') ||
          msg.includes('invalid login credentials')
        ) {
          onDemoFallback(
            target === 'student'
              ? {
                  id: 'demo-student-pesitm',
                  full_name: 'Aarav Kulkarni',
                  usn_or_staff_id: '4PM22CS018',
                  role: 'student',
                }
              : {
                  id: 'demo-driver-pesitm',
                  full_name: 'Ramesh Kumar',
                  usn_or_staff_id: 'DRV-BUS01',
                  role: 'driver',
                }
          );
          return;
        }
        setErrorMessage(`Demo sign-in failed for ${demoEmail}: ${error.message}`);
        return;
      }

      onAuthSuccess(target);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Demo login encountered a network error.'
      );
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 px-6 lg:px-10 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-2.5 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center">
            <BusFront className="w-4.5 h-4.5" strokeWidth={2.25} />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            PESITM Transit
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap shrink-0">
          <span>PES Institute of Technology &amp; Management</span>
          <span aria-hidden="true">·</span>
          <span>Shivamogga, Karnataka</span>
        </div>
      </header>

      {/* Main 2-column split */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-10 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
        {/* Left column: Campus corridor brief & live route overview */}
        <section className="lg:col-span-6 xl:col-span-7 flex flex-col justify-between gap-8">
          <div className="space-y-5">
            <p className="text-sm font-medium text-amber-400">
              Campus Bus Operations · Shivamogga &amp; Bhadravathi
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-[1.12] [text-wrap:balance]">
              Live college bus tracking and instant student alerts.
            </h1>
            <p className="text-base text-slate-400 max-w-xl leading-relaxed">
              Students track live bus locations, route paths, and boarding ETAs on
              OpenStreetMap. Drivers manage assigned route checklists and broadcast
              real-time updates from Shivamogga and Bhadravathi to PESITM Main Gate.
            </p>
          </div>

          {/* Bus-to-Route Directory Preview */}
          <div className="border-t border-slate-800/80 pt-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold text-slate-200">
                Active Campus Bus Corridors
              </h2>
              <span className="text-xs text-slate-400">
                {fleetPreview.length > 0
                  ? `${fleetPreview.length} buses live`
                  : 'Syncing fleet...'}
              </span>
            </div>

            <div className="space-y-3">
              {[
                {
                  number: 'BUS-01',
                  route: 'City Center → PESITM Campus',
                  path: 'Shivamogga Bus Stand → Vinoba Nagar → Gopala → PESITM Main Gate',
                },
                {
                  number: 'BUS-02',
                  route: 'Bhadravathi → PESITM Campus',
                  path: 'Bhadravathi Bus Stand → Paper Town → Gopala → PESITM Main Gate',
                },
              ].map((corridor) => {
                const liveBus = fleetPreview.find(
                  (b) => b.bus_number === corridor.number
                );
                return (
                  <div
                    key={corridor.number}
                    className="p-4 rounded-xl bg-[#111827] border border-slate-800/90 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-bold text-amber-400">
                          {corridor.number}
                        </span>
                        <span className="text-sm font-semibold text-white">
                          {corridor.route}
                        </span>
                      </div>
                      {liveBus && <StatusIndicator status={liveBus.status} size="sm" />}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {corridor.path}
                    </p>
                    {liveBus && (
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/70">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span>Next Stop: {liveBus.next_stop_name}</span>
                        </span>
                        <span className="font-mono text-slate-200">
                          {liveBus.status === 'Arrived'
                            ? 'Arrived'
                            : `ETA ${liveBus.eta_minutes} min`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Right column: Dedicated Student Login & Driver Login Tabs */}
        <section className="lg:col-span-6 xl:col-span-5 flex flex-col justify-center">
          <div className="bg-[#111827] border border-slate-800 rounded-2xl overflow-hidden">
            {/* Two Prominent Top Portal Login Tabs */}
            <div
              role="tablist"
              aria-label="Portal login selector"
              className="grid grid-cols-2 border-b border-slate-800 bg-[#0C1220]"
            >
              <button
                type="button"
                role="tab"
                aria-selected={portalTab === 'student'}
                onClick={() => switchPortalTab('student')}
                className={`flex items-center justify-center gap-2.5 px-4 py-4 text-sm font-display font-bold transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                  portalTab === 'student'
                    ? 'bg-[#111827] text-white border-amber-500'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <GraduationCap
                  className={`w-4.5 h-4.5 ${
                    portalTab === 'student' ? 'text-amber-400' : 'text-slate-500'
                  }`}
                />
                <span>Student Login</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={portalTab === 'driver'}
                onClick={() => switchPortalTab('driver')}
                className={`flex items-center justify-center gap-2.5 px-4 py-4 text-sm font-display font-bold transition-colors border-b-2 cursor-pointer whitespace-nowrap ${
                  portalTab === 'driver'
                    ? 'bg-[#111827] text-white border-amber-500'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                <ShieldCheck
                  className={`w-4.5 h-4.5 ${
                    portalTab === 'driver' ? 'text-amber-400' : 'text-slate-500'
                  }`}
                />
                <span>Driver Login</span>
              </button>
            </div>

            {/* Active Tab Content */}
            <div className="p-6 sm:p-8 space-y-6">
              <div>
                <h2 className="font-display text-xl font-bold text-white">
                  {isSignUp
                    ? portalTab === 'student'
                      ? 'Create Student Account'
                      : 'Create Driver Account'
                    : portalTab === 'student'
                    ? 'Student Portal Sign In'
                    : 'Driver Portal Sign In'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {portalTab === 'student'
                    ? 'Track your bus route, select boarding stops, and receive live arrival alerts.'
                    : 'View your assigned bus duty checklist and broadcast live stop & delay alerts.'}
                </p>
              </div>

              {/* 1-Click Quick Demo Button tailored to the active tab */}
              {!isSignUp && (
                <div className="pb-6 border-b border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-300">
                      Instant Demo Access
                    </span>
                    <span className="font-mono text-[11px] text-slate-500">
                      {portalTab === 'student'
                        ? 'student@pesitm.edu'
                        : 'driver@pesitm.edu'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={loading || demoLoading}
                    onClick={() => handleQuickDemo(portalTab)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    {demoLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : portalTab === 'student' ? (
                      <GraduationCap className="w-4.5 h-4.5" />
                    ) : (
                      <ShieldCheck className="w-4.5 h-4.5" />
                    )}
                    <span>
                      {portalTab === 'student'
                        ? 'Quick Student Demo'
                        : 'Quick Driver Demo'}
                    </span>
                  </button>
                </div>
              )}

              {/* Error / Info Messages */}
              {errorMessage && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {infoMessage && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {/* Email & Password Form */}
              <form
                onSubmit={isSignUp ? handleSignUp : handleSignIn}
                className="space-y-4"
              >
                {isSignUp && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="full-name"
                        className="block text-xs font-medium text-slate-300"
                      >
                        Full Name
                      </label>
                      <input
                        id="full-name"
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={
                          portalTab === 'student' ? 'Ananya Rao' : 'Ramesh Kumar'
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#090D16] border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="usn-staff"
                        className="block text-xs font-medium text-slate-300"
                      >
                        {portalTab === 'student' ? 'Student USN' : 'Driver / Staff ID'}
                      </label>
                      <input
                        id="usn-staff"
                        type="text"
                        required
                        value={usnOrStaffId}
                        onChange={(e) => setUsnOrStaffId(e.target.value)}
                        placeholder={
                          portalTab === 'student' ? '4PM22CS042' : 'DRV-BUS01'
                        }
                        className="w-full px-3.5 py-2.5 rounded-xl bg-[#090D16] border border-slate-800 text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-slate-300"
                  >
                    {portalTab === 'student' ? 'Student Email' : 'Driver Email'}
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={
                      portalTab === 'student'
                        ? 'student@pesitm.edu'
                        : 'driver@pesitm.edu'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#090D16] border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-slate-300"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <input
                      id="auth-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      autoComplete={
                        isSignUp ? 'new-password' : 'current-password'
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#090D16] border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || demoLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-semibold text-sm transition-colors disabled:opacity-60 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>
                        {isSignUp ? 'Creating account...' : 'Signing in...'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {isSignUp
                          ? portalTab === 'student'
                            ? 'Register Student Account'
                            : 'Register Driver Account'
                          : portalTab === 'student'
                          ? 'Sign In to Student Portal'
                          : 'Sign In to Driver Portal'}
                      </span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Toggle Sign In / Sign Up */}
              <div className="pt-2 border-t border-slate-800/80 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setIsSignUp((prev) => !prev);
                    setErrorMessage(null);
                    setInfoMessage(null);
                  }}
                  className="text-xs text-slate-400 hover:text-amber-400 transition-colors cursor-pointer"
                >
                  {isSignUp
                    ? 'Already registered? Back to Sign In'
                    : `Need a new ${
                        portalTab === 'student' ? 'student' : 'driver'
                      } account? Create one`}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
