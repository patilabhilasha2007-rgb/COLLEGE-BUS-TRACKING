import { useState, type FormEvent } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  ArrowRightCircle,
  CheckCircle2,
  Flag,
  Loader2,
  Megaphone,
  Send,
} from 'lucide-react';
import { supabase, getActiveStopIndex, haversineKm } from '../lib/supabase';
import type { AlertType, Bus, NotificationItem, Stop } from '../types/database';

interface DriverControlPanelProps {
  bus: Bus;
  stops: Stop[];
  onBusUpdated: (bus: Bus) => void;
  onNotificationInserted: (notification: NotificationItem) => void;
}

export function DriverControlPanel({
  bus,
  stops,
  onBusUpdated,
  onNotificationInserted,
}: DriverControlPanelProps) {
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [customMessage, setCustomMessage] = useState('');
  const [customAlertType, setCustomAlertType] = useState<AlertType>('info');
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const activeIdx = getActiveStopIndex(bus, stops);

  function showFeedback(type: 'success' | 'error', text: string) {
    setActionFeedback({ type, text });
    window.setTimeout(() => {
      setActionFeedback((curr) => (curr?.text === text ? null : curr));
    }, 4500);
  }

  async function updateBusAndNotify(
    actionKey: string,
    busPatch: Partial<Bus>,
    notificationPayload: {
      title: string;
      message: string;
      alert_type: AlertType;
    },
    successText: string
  ) {
    setBusyAction(actionKey);
    setActionFeedback(null);

    try {
      const { data: updatedBus, error: busError } = await supabase
        .from('buses')
        .update({
          ...busPatch,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bus.id)
        .select()
        .single();

      if (busError) {
        throw new Error(`Bus update failed: ${busError.message}`);
      }

      if (updatedBus) {
        onBusUpdated(updatedBus as Bus);
      }

      const { data: insertedNotif, error: notifError } = await supabase
        .from('notifications')
        .insert({
          bus_id: bus.id,
          title: notificationPayload.title,
          message: notificationPayload.message,
          alert_type: notificationPayload.alert_type,
        })
        .select()
        .single();

      if (notifError) {
        throw new Error(`Notification broadcast failed: ${notifError.message}`);
      }

      if (insertedNotif) {
        onNotificationInserted(insertedNotif as NotificationItem);
      }

      showFeedback('success', successText);
    } catch (err) {
      showFeedback(
        'error',
        err instanceof Error ? err.message : 'Unable to send update to Supabase.'
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMoveToNextStop() {
    if (stops.length === 0) {
      showFeedback('error', 'No stops configured for this bus route.');
      return;
    }

    let destinationIdx: number;

    if (bus.status === 'Arrived') {
      // Restart route from Stop 1
      destinationIdx = 0;
    } else {
      const candidateIdx = activeIdx;
      const candidateStop = stops[candidateIdx];
      const distKm = haversineKm(
        bus.current_lat,
        bus.current_lng,
        candidateStop.lat,
        candidateStop.lng
      );

      if (distKm <= 0.08) {
        destinationIdx = (candidateIdx + 1) % stops.length;
      } else {
        destinationIdx = candidateIdx;
      }
    }

    const reachedStop = stops[destinationIdx];
    const isFinalStop = destinationIdx === stops.length - 1;
    const upcomingStop = isFinalStop
      ? reachedStop
      : stops[destinationIdx + 1];

    const remainingStops = stops.length - 1 - destinationIdx;
    const nextEta = isFinalStop ? 0 : Math.max(5, remainingStops * 5);
    const nextSpeed = isFinalStop ? 0 : 36 + destinationIdx * 3;
    const nextStatus = isFinalStop ? 'Arrived' : 'On Time';

    const title = isFinalStop
      ? `${bus.bus_number} Arrived at ${reachedStop.stop_name}`
      : destinationIdx === 0
      ? `${bus.bus_number} Departed ${reachedStop.stop_name}`
      : `${bus.bus_number} Reached ${reachedStop.stop_name}`;

    const message = isFinalStop
      ? `Bus has reached ${reachedStop.stop_name}. Trip completed safely on schedule.`
      : `Currently at ${reachedStop.stop_name}. Next stop: ${upcomingStop.stop_name} (ETA ${nextEta} min).`;

    await updateBusAndNotify(
      'move',
      {
        current_lat: reachedStop.lat,
        current_lng: reachedStop.lng,
        next_stop_name: upcomingStop.stop_name,
        eta_minutes: nextEta,
        speed_kmh: nextSpeed,
        status: nextStatus,
      },
      {
        title,
        message,
        alert_type: isFinalStop ? 'arrival' : 'info',
      },
      `Moved ${bus.bus_number} to ${reachedStop.stop_name}.`
    );
  }

  async function handleDelayAlert() {
    const newEta = Math.max(0, bus.eta_minutes || 0) + 10;
    const reducedSpeed =
      bus.speed_kmh > 0 ? Math.max(12, Math.round(bus.speed_kmh * 0.55)) : 15;

    await updateBusAndNotify(
      'delay',
      {
        status: 'Delayed',
        eta_minutes: newEta,
        speed_kmh: reducedSpeed,
      },
      {
        title: `${bus.bus_number} Delayed by 10 Minutes`,
        message: `Traffic congestion near ${bus.next_stop_name}. Revised ETA is ${newEta} min.`,
        alert_type: 'warning',
      },
      `10-minute delay alert sent for ${bus.bus_number}.`
    );
  }

  async function handleMarkArrived() {
    const campusStop =
      stops.find((s) => s.stop_name.toLowerCase().includes('pesitm')) ||
      stops[stops.length - 1];

    const targetLat = campusStop ? campusStop.lat : 13.9634;
    const targetLng = campusStop ? campusStop.lng : 75.5085;
    const stopLabel = campusStop ? campusStop.stop_name : 'PESITM Main Gate';

    await updateBusAndNotify(
      'arrived',
      {
        current_lat: targetLat,
        current_lng: targetLng,
        next_stop_name: stopLabel,
        eta_minutes: 0,
        speed_kmh: 0,
        status: 'Arrived',
      },
      {
        title: `${bus.bus_number} Arrived at ${stopLabel}`,
        message: `Bus has arrived at ${stopLabel}, Sagar Road. Students may proceed to classes.`,
        alert_type: 'arrival',
      },
      `Marked ${bus.bus_number} as Arrived at ${stopLabel}.`
    );
  }

  async function handleEmergencyAlert() {
    const newEta = Math.max(bus.eta_minutes || 0, 25);

    await updateBusAndNotify(
      'emergency',
      {
        status: 'Delayed',
        speed_kmh: 0,
        eta_minutes: newEta,
      },
      {
        title: `EMERGENCY: ${bus.bus_number} Breakdown Alert`,
        message: `Vehicle halted near ${bus.next_stop_name}. Replacement college bus is being dispatched from PESITM Campus. Driver contact: ${bus.driver_name} (${bus.driver_phone}).`,
        alert_type: 'warning',
      },
      `Emergency breakdown alert broadcast to all students.`
    );
  }

  async function handleCustomBroadcast(e: FormEvent) {
    e.preventDefault();
    const trimmed = customMessage.trim();
    if (!trimmed) return;

    setBusyAction('broadcast');
    setActionFeedback(null);

    try {
      const { data: insertedNotif, error } = await supabase
        .from('notifications')
        .insert({
          bus_id: bus.id,
          title: `${bus.bus_number} Announcement`,
          message: trimmed,
          alert_type: customAlertType,
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (insertedNotif) {
        onNotificationInserted(insertedNotif as NotificationItem);
      }

      setCustomMessage('');
      showFeedback('success', 'Custom broadcast delivered in real time.');
    } catch (err) {
      showFeedback(
        'error',
        err instanceof Error ? err.message : 'Failed to send broadcast.'
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section
      id="driver-console"
      className="rounded-2xl bg-[#111827] border border-slate-800/90 p-5 space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="font-display text-base font-bold text-white">
            Driver &amp; Admin Live Control Panel
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Controlling{' '}
            <span className="font-mono font-semibold text-amber-400">
              {bus.bus_number}
            </span>{' '}
            · {bus.route_name} · Updates stream immediately to all students
          </p>
        </div>

        {actionFeedback && (
          <div
            role="status"
            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
              actionFeedback.type === 'success'
                ? 'text-emerald-400'
                : 'text-rose-400'
            }`}
          >
            {actionFeedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionFeedback.text}</span>
          </div>
        )}
      </div>

      {/* Primary Action Buttons Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleMoveToNextStop}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
        >
          {busyAction === 'move' ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <ArrowRightCircle className="w-4 h-4 shrink-0" />
          )}
          <span>Move Bus to Next Stop</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleDelayAlert}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/12 hover:bg-amber-500/20 text-amber-300 border border-amber-500/35 font-semibold text-xs transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
        >
          {busyAction === 'delay' ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>Send 10-Min Delay Alert</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleMarkArrived}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-sky-500/12 hover:bg-sky-500/20 text-sky-300 border border-sky-500/35 font-semibold text-xs transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
        >
          {busyAction === 'arrived' ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <Flag className="w-4 h-4 shrink-0" />
          )}
          <span>Mark Arrived at PESITM</span>
        </button>

        <button
          type="button"
          disabled={busyAction !== null}
          onClick={handleEmergencyAlert}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition-colors disabled:opacity-60 whitespace-nowrap cursor-pointer"
        >
          {busyAction === 'emergency' ? (
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          ) : (
            <AlertOctagon className="w-4 h-4 shrink-0" />
          )}
          <span>Emergency / Breakdown Alert</span>
        </button>
      </div>

      {/* Custom Broadcast Form */}
      <form
        onSubmit={handleCustomBroadcast}
        className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
      >
        <div className="relative flex-1">
          <Megaphone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder={`Broadcast live announcement for ${bus.bus_number} students...`}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#090D16] border border-slate-800 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-500/70 transition-colors"
          />
        </div>

        <select
          aria-label="Broadcast alert severity"
          value={customAlertType}
          onChange={(e) => setCustomAlertType(e.target.value as AlertType)}
          className="px-3 py-2.5 rounded-xl bg-[#090D16] border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-amber-500/70"
        >
          <option value="info">Info Alert</option>
          <option value="warning">Warning Alert</option>
          <option value="arrival">Arrival Alert</option>
        </select>

        <button
          type="submit"
          disabled={busyAction !== null || !customMessage.trim()}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 font-semibold text-xs transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {busyAction === 'broadcast' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>Broadcast</span>
        </button>
      </form>
    </section>
  );
}
