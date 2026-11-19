import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  MapPin,
  Navigation,
} from 'lucide-react';
import type { Bus, Stop } from '../types/database';
import { getActiveStopIndex } from '../lib/supabase';

interface TimetablePanelProps {
  bus: Bus;
  stops: Stop[];
  boardingStopId: string | null;
  onSelectBoardingStop: (stopId: string) => void;
}

export function TimetablePanel({
  bus,
  stops,
  boardingStopId,
  onSelectBoardingStop,
}: TimetablePanelProps) {
  const activeIdx = getActiveStopIndex(bus, stops);
  const selectedBoardingStop = stops.find((s) => s.id === boardingStopId) || null;
  const boardingIdx = selectedBoardingStop
    ? stops.findIndex((s) => s.id === selectedBoardingStop.id)
    : -1;

  function computeStopEtaMinutes(stopIdx: number): number | null {
    if (bus.status === 'Arrived') return 0;
    if (stopIdx < activeIdx) return null;
    if (stopIdx === activeIdx) return Math.max(0, bus.eta_minutes);
    return Math.max(0, bus.eta_minutes) + (stopIdx - activeIdx) * 8;
  }

  const boardingEta =
    boardingIdx !== -1 ? computeStopEtaMinutes(boardingIdx) : null;

  return (
    <section
      id="timetable-section"
      className="rounded-2xl bg-[#111827] border border-slate-800/90 overflow-hidden"
    >
      {/* Header & Personal Boarding Summary */}
      <div className="p-5 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-bold text-white">
            Route Timetable &amp; Boarding Stop Status
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {bus.bus_number} · {bus.route_name} · Click any stop to set your boarding
            point
          </p>
        </div>

        {selectedBoardingStop && (
          <div className="flex items-center gap-3 text-xs bg-[#090D16] border border-slate-800 rounded-xl px-3.5 py-2.5 shrink-0">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-slate-400">
                Boarding:{' '}
                <span className="text-white font-semibold">
                  {selectedBoardingStop.stop_name}
                </span>
              </div>
              <div className="font-mono text-[11px] text-amber-400 mt-0.5">
                {bus.status === 'Arrived'
                  ? 'Bus reached campus'
                  : boardingEta === null
                  ? 'Bus already passed this stop'
                  : boardingEta === 0
                  ? 'Arriving now'
                  : `Est. arrival in ${boardingEta} min (${bus.status})`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Responsive Timetable Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800/80 text-xs font-medium text-slate-400 bg-[#0D1322]">
              <th className="py-3 pl-5 pr-3 w-16">Stop</th>
              <th className="py-3 px-3">Location</th>
              <th className="py-3 px-3">Scheduled</th>
              <th className="py-3 px-3">Live Status</th>
              <th className="py-3 px-3 text-right">Est. Arrival</th>
              <th className="py-3 pl-3 pr-5 text-right">Boarding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 text-sm">
            {stops.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                  No stops found for this route yet.
                </td>
              </tr>
            ) : (
              stops.map((stop, idx) => {
                const isBoarding = stop.id === boardingStopId;
                const isLast = idx === stops.length - 1;
                const isArrived = bus.status === 'Arrived';
                const isPassed = isArrived ? !isLast : idx < activeIdx;
                const isApproaching = !isArrived && idx === activeIdx;
                const isAtCampus = isArrived && isLast;
                const estMin = computeStopEtaMinutes(idx);

                return (
                  <tr
                    key={stop.id}
                    className={`transition-colors ${
                      isBoarding
                        ? 'bg-amber-500/[0.06]'
                        : 'hover:bg-slate-800/35'
                    }`}
                  >
                    <td className="py-3.5 pl-5 pr-3 font-mono text-xs text-slate-400">
                      {String(stop.stop_order).padStart(2, '0')}
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-100">
                          {stop.stop_name}
                        </span>
                        {isBoarding && (
                          <span className="text-xs text-amber-400 font-medium">
                            · Your stop
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-mono text-xs text-slate-300 whitespace-nowrap">
                      {stop.scheduled_time}
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      {isAtCampus ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400">
                          <Flag className="w-3.5 h-3.5" />
                          <span>Arrived</span>
                        </span>
                      ) : isPassed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Passed</span>
                        </span>
                      ) : isApproaching ? (
                        bus.status === 'Delayed' ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-400">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Delayed · Next Stop</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300">
                            <Navigation className="w-3.5 h-3.5" />
                            <span>Approaching</span>
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Upcoming</span>
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono text-xs whitespace-nowrap">
                      {isAtCampus ? (
                        <span className="text-sky-400">At Gate</span>
                      ) : isPassed ? (
                        <span className="text-slate-500">Departed</span>
                      ) : estMin === 0 ? (
                        <span className="text-emerald-400 font-semibold">Now</span>
                      ) : (
                        <span
                          className={
                            isApproaching
                              ? 'text-white font-semibold'
                              : 'text-slate-300'
                          }
                        >
                          {estMin} min
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectBoardingStop(stop.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          isBoarding
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-[#090D16] hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        {isBoarding && <Check className="w-3.5 h-3.5" />}
                        <span>{isBoarding ? 'Selected' : 'Set Boarding'}</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
