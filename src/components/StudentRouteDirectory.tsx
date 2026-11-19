import {
  AlertTriangle,
  BusFront,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  MapPin,
  Navigation,
} from 'lucide-react';
import { getActiveStopIndex, getStopsForBus } from '../lib/supabase';
import type { Bus, Stop } from '../types/database';
import { StatusIndicator } from './StatusIndicator';

interface StudentRouteDirectoryProps {
  buses: Bus[];
  allStops: Stop[];
  selectedBus: Bus | null;
  selectedStops: Stop[];
  boardingStopId: string | null;
  onSelectBus: (busId: string) => void;
  onSelectBoardingStop: (stopId: string) => void;
}

export function StudentRouteDirectory({
  buses,
  allStops,
  selectedBus,
  selectedStops,
  boardingStopId,
  onSelectBus,
  onSelectBoardingStop,
}: StudentRouteDirectoryProps) {
  const activeIdx = selectedBus
    ? getActiveStopIndex(selectedBus, selectedStops)
    : 0;

  return (
    <section
      id="route-directory"
      className="rounded-2xl bg-[#111827] border border-slate-800/90 p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h1 className="font-display text-base sm:text-lg font-bold text-white">
            Bus &amp; Route Directory
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Select a bus below to inspect its full step-by-step route path and live
            pins on the map
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400">
          {buses.length} Active Campus Routes
        </span>
      </div>

      {/* Bus-to-Route Mapping Cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 gap-3.5"
        role="listbox"
        aria-label="Bus and route directory"
      >
        {buses.map((bus) => {
          const isSelected = selectedBus?.id === bus.id;
          const busStops = getStopsForBus(bus, allStops);
          const stopChain = busStops.map((s) => s.stop_name).join(' → ');

          return (
            <button
              key={bus.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectBus(bus.id)}
              className={`text-left p-4 rounded-xl border transition-colors cursor-pointer flex flex-col gap-2.5 ${
                isSelected
                  ? 'bg-[#172136] border-amber-500/80'
                  : 'bg-[#0C1220] border-slate-800/90 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-flex items-center gap-1.5 font-mono text-sm font-bold shrink-0 ${
                      isSelected ? 'text-amber-400' : 'text-white'
                    }`}
                  >
                    <BusFront className="w-4 h-4" />
                    {bus.bus_number}
                  </span>
                  <span className="text-sm font-semibold text-white truncate">
                    {bus.route_name}
                  </span>
                </div>
                <StatusIndicator status={bus.status} size="sm" />
              </div>

              <p className="text-xs text-slate-300 leading-relaxed">
                <span className="text-slate-500 font-medium">Route: </span>
                {stopChain}
              </p>

              <div className="flex items-center justify-between gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                <span className="truncate">
                  Next Stop:{' '}
                  <strong className="text-slate-200 font-medium">
                    {bus.next_stop_name}
                  </strong>
                </span>
                <span className="font-mono text-amber-400 font-semibold shrink-0">
                  {bus.status === 'Arrived'
                    ? 'Arrived'
                    : `ETA ${bus.eta_minutes} min`}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Step-by-Step Vertical Route Timeline for Selected Bus */}
      {selectedBus && selectedStops.length > 0 && (
        <div className="pt-4 border-t border-slate-800/80 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-bold text-white">
                {selectedBus.bus_number} Step-by-Step Route Path
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedBus.route_name} · Click any stop to mark your boarding point
              </p>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {selectedStops.length} Stops · Start to PESITM Main Gate
            </span>
          </div>

          <ol className="relative space-y-0">
            {selectedStops.map((stop, idx) => {
              const isLast = idx === selectedStops.length - 1;
              const isArrived = selectedBus.status === 'Arrived';
              const isCompleted = isArrived ? true : idx < activeIdx;
              const isCurrent = !isArrived && idx === activeIdx;
              const isBoarding = stop.id === boardingStopId;

              return (
                <li
                  key={stop.id}
                  className="relative flex items-start gap-4 pb-5 last:pb-0"
                >
                  {/* Vertical connecting track */}
                  {!isLast && (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${
                        isCompleted ? 'bg-emerald-500/70' : 'bg-slate-800'
                      }`}
                    />
                  )}

                  {/* Timeline step circle */}
                  <div
                    className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 border ${
                      isArrived && isLast
                        ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                        : isCompleted
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : isCurrent
                        ? 'bg-amber-500 text-slate-950 border-amber-300'
                        : 'bg-[#090D16] border-slate-700 text-slate-400'
                    }`}
                  >
                    {isArrived && isLast ? (
                      <Flag className="w-3.5 h-3.5" />
                    ) : isCompleted ? (
                      <Check className="w-4 h-4" strokeWidth={2.5} />
                    ) : (
                      stop.stop_order
                    )}
                  </div>

                  {/* Step content row */}
                  <div
                    className={`flex-1 min-w-0 rounded-xl px-4 py-3 border transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'bg-amber-500/[0.08] border-amber-500/50'
                        : isBoarding
                        ? 'bg-[#172136] border-slate-700'
                        : 'bg-[#0C1220] border-slate-800/80'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-white">
                          {stop.stop_name}
                        </span>
                        <span className="font-mono text-xs text-slate-400">
                          · {stop.scheduled_time}
                        </span>
                        {isBoarding && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400">
                            <MapPin className="w-3 h-3" />
                            Your Boarding Stop
                          </span>
                        )}
                      </div>

                      <div className="text-xs">
                        {isArrived && isLast ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-sky-400">
                            <Flag className="w-3.5 h-3.5" />
                            Bus Arrived at PESITM Main Gate
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Completed
                          </span>
                        ) : isCurrent ? (
                          selectedBus.status === 'Delayed' ? (
                            <span className="inline-flex items-center gap-1.5 font-medium text-amber-400">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Current / Next Stop · Delayed (ETA{' '}
                              <span className="font-mono">
                                {selectedBus.eta_minutes} min
                              </span>
                              )
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-medium text-amber-300">
                              <Navigation className="w-3.5 h-3.5" />
                              Current / Next Stop · ETA{' '}
                              <span className="font-mono">
                                {selectedBus.eta_minutes} min
                              </span>
                            </span>
                          )
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            Upcoming Stop
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectBoardingStop(stop.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        isBoarding
                          ? 'bg-amber-500 text-slate-950 font-semibold'
                          : 'bg-[#090D16] hover:bg-slate-800 text-slate-300 border border-slate-800'
                      }`}
                    >
                      {isBoarding ? 'Boarding Stop' : 'Set Boarding'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </section>
  );
}
