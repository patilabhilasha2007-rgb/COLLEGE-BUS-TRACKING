import {
  AlertTriangle,
  BusFront,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Navigation,
  Phone,
  Route,
} from 'lucide-react';
import { getActiveStopIndex } from '../lib/supabase';
import type { Bus, Stop } from '../types/database';
import { StatusIndicator } from './StatusIndicator';

interface DriverDutyCardProps {
  buses: Bus[];
  bus: Bus;
  stops: Stop[];
  onSelectBus: (busId: string) => void;
}

export function DriverDutyCard({
  buses,
  bus,
  stops,
  onSelectBus,
}: DriverDutyCardProps) {
  const activeIdx = getActiveStopIndex(bus, stops);
  const isArrived = bus.status === 'Arrived';

  return (
    <section
      id="assigned-duty"
      className="rounded-2xl bg-[#111827] border border-slate-800/90 p-5 space-y-5"
    >
      {/* Top Duty Header & Bus Preview Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
            <Route className="w-3.5 h-3.5" />
            <span>Your Assigned Duty</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-lg sm:text-xl font-bold text-white">
              <span className="font-mono text-amber-400 mr-2">
                {bus.bus_number}
              </span>
              {bus.route_name}
            </h1>
            <StatusIndicator status={bus.status} size="md" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-0.5">
            <span>Driver: {bus.driver_name}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 font-mono text-slate-300">
              <Phone className="w-3 h-3 text-slate-500" />
              {bus.driver_phone}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-300">
              Speed: {bus.speed_kmh} km/h
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-amber-400 font-semibold">
              {isArrived ? 'Trip Arrived' : `Next ETA: ${bus.eta_minutes} min`}
            </span>
          </div>
        </div>

        {/* Assigned Bus Switcher (preview BUS-01 / BUS-02) */}
        {buses.length > 1 && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-[#090D16] border border-slate-800 self-start shrink-0">
            {buses.map((b) => {
              const isSelected = b.id === bus.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectBus(b.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  <BusFront className="w-3.5 h-3.5" />
                  <span>{b.bus_number}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Ordered Route Checklist */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-slate-200">
            Ordered Route Checklist
          </h2>
          <span className="text-xs font-mono text-slate-400">
            {isArrived
              ? `${stops.length} of ${stops.length} stops completed`
              : `Active Stop ${Math.min(activeIdx + 1, stops.length)} of ${
                  stops.length
                }`}
          </span>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {stops.map((stop, idx) => {
            const isLast = idx === stops.length - 1;
            const isCompleted = isArrived ? true : idx < activeIdx;
            const isActiveStop = !isArrived && idx === activeIdx;

            return (
              <li
                key={stop.id}
                className={`rounded-xl p-3.5 border transition-colors flex flex-col justify-between gap-3 ${
                  isArrived && isLast
                    ? 'bg-sky-500/10 border-sky-500/50'
                    : isActiveStop
                    ? 'bg-amber-500/12 border-amber-500/70'
                    : isCompleted
                    ? 'bg-emerald-500/[0.06] border-emerald-500/35'
                    : 'bg-[#0C1220] border-slate-800/80'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                        isArrived && isLast
                          ? 'bg-sky-500 text-slate-950'
                          : isActiveStop
                          ? 'bg-amber-500 text-slate-950'
                          : isCompleted
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {isCompleted ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={2.75} />
                      ) : (
                        stop.stop_order
                      )}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {stop.scheduled_time}
                    </span>
                  </div>

                  {isArrived && isLast ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                      <Flag className="w-3 h-3" />
                      Arrived
                    </span>
                  ) : isActiveStop ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                      {bus.status === 'Delayed' ? (
                        <AlertTriangle className="w-3 h-3" />
                      ) : (
                        <Navigation className="w-3 h-3" />
                      )}
                      Active
                    </span>
                  ) : isCompleted ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                      <CheckCircle2 className="w-3 h-3" />
                      Done
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="w-3 h-3" />
                      Next
                    </span>
                  )}
                </div>

                <div>
                  <p className="text-sm font-semibold text-white leading-snug">
                    {stop.stop_order}. {stop.stop_name}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {isArrived && isLast
                      ? 'Destination reached'
                      : isActiveStop
                      ? `Current target · ETA ${bus.eta_minutes} min`
                      : isCompleted
                      ? 'Stop cleared'
                      : 'Queued on route'}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
