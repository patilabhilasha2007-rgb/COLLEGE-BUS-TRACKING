import { createClient } from '@supabase/supabase-js';
import type { Bus, Stop } from '../types/database';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://vhuqncasouqbaemzqrry.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_jHJ_Apcqwmmn2j3yaKhLCw_P7JvxJrT';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Fallback route coordinates for Shivamogga corridor if a bus has no rows yet in the `stops` table
 * (e.g., BUS-02 Bhadravathi -> PESITM Campus).
 */
export function getStopsForBus(bus: Bus, allStops: Stop[]): Stop[] {
  const directStops = allStops
    .filter((s) => s.bus_id === bus.id)
    .sort((a, b) => a.stop_order - b.stop_order);

  if (directStops.length > 0) {
    return directStops;
  }

  // Fallback corridor stops for secondary buses so map & driver controls work seamlessly
  if (bus.route_name.toLowerCase().includes('bhadravathi')) {
    return [
      {
        id: `${bus.id}-fallback-1`,
        bus_id: bus.id,
        stop_name: 'Bhadravathi Bus Stand',
        stop_order: 1,
        lat: 13.8485,
        lng: 75.705,
        scheduled_time: '07:45 AM',
      },
      {
        id: `${bus.id}-fallback-2`,
        bus_id: bus.id,
        stop_name: 'Paper Town',
        stop_order: 2,
        lat: 13.8615,
        lng: 75.6805,
        scheduled_time: '08:00 AM',
      },
      {
        id: `${bus.id}-fallback-3`,
        bus_id: bus.id,
        stop_name: 'Gopala',
        stop_order: 3,
        lat: 13.949,
        lng: 75.5395,
        scheduled_time: '08:22 AM',
      },
      {
        id: `${bus.id}-fallback-4`,
        bus_id: bus.id,
        stop_name: 'PESITM Main Gate',
        stop_order: 4,
        lat: 13.9634,
        lng: 75.5085,
        scheduled_time: '08:35 AM',
      },
    ];
  }

  // Default to the primary Shivamogga route stops
  return allStops
    .slice()
    .sort((a, b) => a.stop_order - b.stop_order);
}

/**
 * Haversine distance in kilometers between two GPS points.
 */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Determines the current stop index (0-based) the bus is approaching or at.
 */
export function getActiveStopIndex(bus: Bus, stops: Stop[]): number {
  if (stops.length === 0) return 0;

  if (bus.status === 'Arrived') {
    return stops.length - 1;
  }

  // Match by next_stop_name first (case-insensitive)
  const byName = stops.findIndex(
    (s) => s.stop_name.toLowerCase() === (bus.next_stop_name || '').toLowerCase()
  );
  if (byName !== -1) {
    return byName;
  }

  // Fallback: nearest stop
  let closestIdx = 0;
  let minDist = Infinity;
  stops.forEach((s, idx) => {
    const d = haversineKm(bus.current_lat, bus.current_lng, s.lat, s.lng);
    if (d < minDist) {
      minDist = d;
      closestIdx = idx;
    }
  });
  return closestIdx;
}

/**
 * Format timestamp nicely for timetable/notification feeds.
 */
export function formatTimeAgo(isoString: string): string {
  if (!isoString) return 'Just now';
  const date = new Date(isoString);
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 15) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatClockTime(isoString: string): string {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function isEmergencyNotification(title: string, message: string): boolean {
  const combined = `${title} ${message}`.toLowerCase();
  return (
    combined.includes('emergency') ||
    combined.includes('breakdown') ||
    combined.includes('urgent') ||
    combined.includes('sos')
  );
}
