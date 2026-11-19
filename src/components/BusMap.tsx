import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { BusFront, Check, Crosshair, MapPin, Navigation } from 'lucide-react';
import type { Bus, Stop } from '../types/database';
import { getActiveStopIndex } from '../lib/supabase';

declare const __GOOGLE_MAPS_API_KEY__: string | undefined;

interface BusMapProps {
  bus: Bus | null;
  stops: Stop[];
  boardingStopId: string | null;
  onSelectBoardingStop: (stopId: string) => void;
}

type StopProgressState = 'completed' | 'active' | 'upcoming';

const SHIVAMOGGA_CENTER = { lat: 13.945, lng: 75.54 };
const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_ATTRIBUTION = '&copy; OpenStreetMap contributors';

const GOOGLE_MAPS_API_KEY: string =
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||
  (typeof __GOOGLE_MAPS_API_KEY__ !== 'undefined'
    ? __GOOGLE_MAPS_API_KEY__
    : '') ||
  '';

function getStopState(
  stopIndex: number,
  activeIdx: number,
  busStatus?: Bus['status']
): StopProgressState {
  if (busStatus === 'Arrived') {
    return 'completed';
  }
  if (stopIndex < activeIdx) {
    return 'completed';
  }
  if (stopIndex === activeIdx) {
    return 'active';
  }
  return 'upcoming';
}

/* ============================================================================
 * Color-Coded Route Stop Progress Legend (Completed / Active / Upcoming)
 * ============================================================================ */
function RouteStopLegend({
  completedCount,
  activeCount,
  upcomingCount,
  hasBoardingStop,
  mapProviderLabel,
}: {
  completedCount: number;
  activeCount: number;
  upcomingCount: number;
  hasBoardingStop: boolean;
  mapProviderLabel: string;
}) {
  return (
    <div
      aria-label="Route stop status legend"
      className="bg-[#0D1322] border-t border-slate-800/90 px-4 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5"
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <span className="font-display font-semibold text-slate-300">
          Route Legend
        </span>

        {/* Completed Stop */}
        <span className="inline-flex items-center gap-2 text-slate-200">
          <span
            aria-hidden="true"
            className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-emerald-200 text-slate-950 inline-flex items-center justify-center shrink-0"
          >
            <Check className="w-3 h-3" strokeWidth={3} />
          </span>
          <span>
            Completed{' '}
            <span className="font-mono text-emerald-400">({completedCount})</span>
          </span>
        </span>

        {/* Active Stop */}
        <span className="inline-flex items-center gap-2 text-slate-200">
          <span
            aria-hidden="true"
            className="w-5 h-5 rounded-full bg-amber-500 border-2 border-amber-100 text-slate-950 font-mono text-[10px] font-bold inline-flex items-center justify-center ring-2 ring-amber-500/35 shrink-0"
          >
            ●
          </span>
          <span>
            Active{' '}
            <span className="font-mono text-amber-400">({activeCount})</span>
          </span>
        </span>

        {/* Upcoming Stop */}
        <span className="inline-flex items-center gap-2 text-slate-200">
          <span
            aria-hidden="true"
            className="w-5 h-5 rounded-full bg-slate-700 border-2 border-slate-300 text-white font-mono text-[10px] font-bold inline-flex items-center justify-center shrink-0"
          >
            #
          </span>
          <span>
            Upcoming{' '}
            <span className="font-mono text-slate-400">({upcomingCount})</span>
          </span>
        </span>

        {/* Boarding Stop Ring Indicator */}
        {hasBoardingStop && (
          <span className="inline-flex items-center gap-2 text-slate-300">
            <span
              aria-hidden="true"
              className="w-4 h-4 rounded-full bg-transparent border-2 border-sky-400 ring-2 ring-sky-400/30 shrink-0"
            />
            <span>Your Boarding Stop</span>
          </span>
        )}
      </div>

      <span className="font-mono text-[11px] text-slate-500">
        {mapProviderLabel}
      </span>
    </div>
  );
}

/* ============================================================================
 * Google Maps Platform Inner Scene (@vis.gl/react-google-maps)
 * ============================================================================ */
function GoogleRoutePolylines({
  stops,
  activeIdx,
  busStatus,
}: {
  stops: Stop[];
  activeIdx: number;
  busStatus?: Bus['status'];
}) {
  const map = useMap();
  const mapsLib = useMapsLibrary('maps');

  useEffect(() => {
    if (!map || !mapsLib || stops.length < 2) return;

    const fullPath = stops.map((s) => ({ lat: s.lat, lng: s.lng }));

    // Dark outline for contrast across road labels
    const casingLine = new mapsLib.Polyline({
      path: fullPath,
      strokeColor: '#0F172A',
      strokeOpacity: 0.72,
      strokeWeight: 8,
      zIndex: 1,
      map,
    });

    // Upcoming/active corridor path in amber
    const remainingLine = new mapsLib.Polyline({
      path: fullPath,
      strokeColor: '#F59E0B',
      strokeOpacity: 0.95,
      strokeWeight: 4,
      zIndex: 2,
      map,
    });

    // Completed portion highlighted in emerald
    let completedLine: InstanceType<typeof mapsLib.Polyline> | null = null;
    const completedEndIdx =
      busStatus === 'Arrived' ? stops.length - 1 : Math.max(0, activeIdx);

    if (completedEndIdx >= 1) {
      completedLine = new mapsLib.Polyline({
        path: fullPath.slice(0, completedEndIdx + 1),
        strokeColor: '#10B981',
        strokeOpacity: 0.95,
        strokeWeight: 4.5,
        zIndex: 3,
        map,
      });
    }

    return () => {
      casingLine.setMap(null);
      remainingLine.setMap(null);
      if (completedLine) {
        completedLine.setMap(null);
      }
    };
  }, [map, mapsLib, stops, activeIdx, busStatus]);

  return null;
}

function GoogleCameraController({
  bus,
  stops,
  followBus,
  recenterNonce,
}: {
  bus: Bus | null;
  stops: Stop[];
  followBus: boolean;
  recenterNonce: number;
}) {
  const map = useMap();
  const coreLib = useMapsLibrary('core');
  const lastBusIdRef = useRef<string | null>(null);

  const fitRouteBounds = useCallback(() => {
    if (!map || !coreLib) return;
    const bounds = new coreLib.LatLngBounds();
    let count = 0;
    stops.forEach((s) => {
      bounds.extend({ lat: s.lat, lng: s.lng });
      count++;
    });
    if (bus) {
      bounds.extend({ lat: bus.current_lat, lng: bus.current_lng });
      count++;
    }
    if (count > 1) {
      map.fitBounds(bounds, { top: 56, right: 56, bottom: 56, left: 56 });
    } else if (bus) {
      map.panTo({ lat: bus.current_lat, lng: bus.current_lng });
      map.setZoom(14);
    }
  }, [map, coreLib, stops, bus]);

  // Fit bounds when switching buses
  useEffect(() => {
    if (!bus || !map || !coreLib) return;
    if (lastBusIdRef.current !== bus.id) {
      lastBusIdRef.current = bus.id;
      fitRouteBounds();
    } else if (followBus) {
      map.panTo({ lat: bus.current_lat, lng: bus.current_lng });
    }
  }, [bus, map, coreLib, followBus, fitRouteBounds]);

  // Explicit recenter trigger
  useEffect(() => {
    if (recenterNonce > 0) {
      fitRouteBounds();
    }
  }, [recenterNonce, fitRouteBounds]);

  return null;
}

function GoogleBusMapView({
  bus,
  stops,
  boardingStopId,
  onSelectBoardingStop,
}: BusMapProps) {
  const [followBus, setFollowBus] = useState(false);
  const [recenterNonce, setRecenterNonce] = useState(0);
  const [selectedStopPopup, setSelectedStopPopup] = useState<Stop | null>(null);
  const [showBusInfo, setShowBusInfo] = useState(false);

  // Smoothly interpolate live bus coordinates
  const [animatedBusPos, setAnimatedBusPos] = useState<{
    lat: number;
    lng: number;
  } | null>(bus ? { lat: bus.current_lat, lng: bus.current_lng } : null);
  const animatedPosRef = useRef<{ lat: number; lng: number } | null>(
    animatedBusPos
  );
  const lastAnimatedBusIdRef = useRef<string | null>(bus?.id ?? null);

  useEffect(() => {
    if (!bus) {
      setAnimatedBusPos(null);
      animatedPosRef.current = null;
      return;
    }

    const target = { lat: bus.current_lat, lng: bus.current_lng };
    const start = animatedPosRef.current;

    if (!start || lastAnimatedBusIdRef.current !== bus.id) {
      lastAnimatedBusIdRef.current = bus.id;
      animatedPosRef.current = target;
      setAnimatedBusPos(target);
      return;
    }

    if (
      Math.abs(start.lat - target.lat) < 0.00001 &&
      Math.abs(start.lng - target.lng) < 0.00001
    ) {
      return;
    }

    let rafId = 0;
    const duration = 900;
    const startTime = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextPos = {
        lat: start.lat + (target.lat - start.lat) * eased,
        lng: start.lng + (target.lng - start.lng) * eased,
      };
      animatedPosRef.current = nextPos;
      setAnimatedBusPos(nextPos);
      if (progress < 1) {
        rafId = requestAnimationFrame(step);
      }
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [bus?.id, bus?.current_lat, bus?.current_lng]);

  const activeIdx = bus ? getActiveStopIndex(bus, stops) : 0;

  const legendCounts = useMemo(() => {
    let completed = 0;
    let active = 0;
    let upcoming = 0;
    stops.forEach((_, idx) => {
      const state = getStopState(idx, activeIdx, bus?.status);
      if (state === 'completed') completed++;
      else if (state === 'active') active++;
      else upcoming++;
    });
    return { completed, active, upcoming };
  }, [stops, activeIdx, bus?.status]);

  const busAccent =
    bus?.status === 'Delayed'
      ? '#F59E0B'
      : bus?.status === 'Arrived'
      ? '#0EA5E9'
      : '#10B981';

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800/90 bg-[#0B1120]">
      <div className="relative w-full h-[440px] sm:h-[520px] lg:h-[540px]">
        <APIProvider
          apiKey={GOOGLE_MAPS_API_KEY}
          language="en"
          region="IN"
        >
          <GoogleMap
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            defaultCenter={SHIVAMOGGA_CENTER}
            defaultZoom={13}
            gestureHandling="greedy"
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl={false}
            style={{ width: '100%', height: '100%' }}
            onClick={() => {
              setSelectedStopPopup(null);
              setShowBusInfo(false);
            }}
          >
            <GoogleRoutePolylines
              stops={stops}
              activeIdx={activeIdx}
              busStatus={bus?.status}
            />

            <GoogleCameraController
              bus={bus}
              stops={stops}
              followBus={followBus}
              recenterNonce={recenterNonce}
            />

            {/* Color-Coded Route Stop AdvancedMarkers (Completed / Active / Upcoming) */}
            {stops.map((stop, idx) => {
              const state = getStopState(idx, activeIdx, bus?.status);
              const isBoarding = stop.id === boardingStopId;

              const pinStyle =
                state === 'completed'
                  ? 'bg-emerald-500 border-emerald-100 text-slate-950'
                  : state === 'active'
                  ? 'bg-amber-500 border-amber-100 text-slate-950 scale-110'
                  : 'bg-slate-700 border-slate-200 text-white';

              const boardingRing = isBoarding
                ? 'ring-4 ring-sky-400/80 shadow-[0_0_0_6px_rgba(56,189,248,0.28)]'
                : 'shadow-lg shadow-black/45';

              return (
                <AdvancedMarker
                  key={stop.id}
                  position={{ lat: stop.lat, lng: stop.lng }}
                  zIndex={state === 'active' ? 350 : isBoarding ? 300 : 120}
                  title={`Stop ${stop.stop_order}: ${stop.stop_name} (${state})`}
                  onClick={() => {
                    onSelectBoardingStop(stop.id);
                    setShowBusInfo(false);
                    setSelectedStopPopup(stop);
                  }}
                >
                  <div className="relative flex flex-col items-center cursor-pointer">
                    {state === 'active' && (
                      <span
                        aria-hidden="true"
                        className="bus-marker-radar absolute inset-0 rounded-full bg-amber-500/45"
                      />
                    )}
                    <div
                      className={`relative w-8 h-8 rounded-full border-2 font-mono text-xs font-bold flex items-center justify-center transition-transform ${pinStyle} ${boardingRing}`}
                    >
                      {state === 'completed' ? (
                        <Check className="w-4 h-4" strokeWidth={3} />
                      ) : (
                        stop.stop_order
                      )}
                    </div>
                  </div>
                </AdvancedMarker>
              );
            })}

            {/* Live Moving Bus AdvancedMarker */}
            {bus && animatedBusPos && (
              <AdvancedMarker
                position={animatedBusPos}
                zIndex={1000}
                title={`${bus.bus_number} — ${bus.status}`}
                onClick={() => {
                  setSelectedStopPopup(null);
                  setShowBusInfo(true);
                }}
              >
                <div className="relative flex flex-col items-center cursor-pointer">
                  <div
                    className="mb-1 px-2 py-0.5 rounded-md bg-[#090D16] text-white font-mono text-[10px] font-bold whitespace-nowrap shadow-lg"
                    style={{ border: `1.5px solid ${busAccent}` }}
                  >
                    {bus.bus_number}
                  </div>
                  <div className="relative w-10 h-10 flex items-center justify-center">
                    <span
                      aria-hidden="true"
                      className="bus-marker-radar absolute inset-0 rounded-full opacity-45"
                      style={{ backgroundColor: busAccent }}
                    />
                    <div
                      className="relative w-10 h-10 rounded-xl bg-[#090D16] flex items-center justify-center shadow-xl"
                      style={{
                        border: `2.5px solid ${busAccent}`,
                        color: busAccent,
                      }}
                    >
                      <BusFront className="w-5 h-5" strokeWidth={2.25} />
                    </div>
                  </div>
                </div>
              </AdvancedMarker>
            )}

            {/* Selected Stop InfoWindow */}
            {selectedStopPopup && (
              <InfoWindow
                position={{
                  lat: selectedStopPopup.lat,
                  lng: selectedStopPopup.lng,
                }}
                pixelOffset={[0, -24]}
                onCloseClick={() => setSelectedStopPopup(null)}
              >
                <div className="text-slate-900 min-w-[175px] p-1">
                  <div className="font-mono text-[11px] text-slate-500">
                    Stop #{selectedStopPopup.stop_order} ·{' '}
                    {selectedStopPopup.scheduled_time}
                  </div>
                  <div className="font-display text-sm font-bold text-slate-950 mt-0.5">
                    {selectedStopPopup.stop_name}
                  </div>
                  {selectedStopPopup.id === boardingStopId && (
                    <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-sky-700">
                      <MapPin className="w-3 h-3" />
                      <span>Selected Boarding Stop</span>
                    </div>
                  )}
                </div>
              </InfoWindow>
            )}

            {/* Active Bus InfoWindow */}
            {showBusInfo && bus && animatedBusPos && (
              <InfoWindow
                position={animatedBusPos}
                pixelOffset={[0, -34]}
                onCloseClick={() => setShowBusInfo(false)}
              >
                <div className="text-slate-900 min-w-[190px] p-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-950">
                      {bus.bus_number}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700">
                      {bus.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {bus.route_name}
                  </div>
                  <div className="mt-2 pt-1.5 border-t border-slate-200 font-mono text-[11px] text-slate-700">
                    Next: {bus.next_stop_name}
                    <br />
                    ETA: {bus.eta_minutes} min · {bus.speed_kmh} km/h
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </APIProvider>

        {/* Top-right floating map controls */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFollowBus((prev) => !prev)}
            title="Lock map camera onto moving bus"
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-md ${
              followBus
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'bg-[#090D16]/90 text-slate-100 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Follow Bus</span>
          </button>

          <button
            type="button"
            onClick={() => setRecenterNonce((n) => n + 1)}
            title="Fit full route in view"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#090D16]/90 hover:bg-slate-800 text-slate-100 backdrop-blur-md border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-md"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Fit Route</span>
          </button>
        </div>
      </div>

      {/* Clear Color-Coded Stop Legend */}
      <RouteStopLegend
        completedCount={legendCounts.completed}
        activeCount={legendCounts.active}
        upcomingCount={legendCounts.upcoming}
        hasBoardingStop={Boolean(boardingStopId)}
        mapProviderLabel="Google Maps"
      />
    </div>
  );
}

/* ============================================================================
 * OSM Street Fallback (if VITE_GOOGLE_MAPS_API_KEY is unset in external deploys)
 * ============================================================================ */
function createLeafletStopIcon(
  order: number,
  state: StopProgressState,
  isBoarding: boolean
) {
  const bg =
    state === 'completed'
      ? '#10B981'
      : state === 'active'
      ? '#F59E0B'
      : '#334155';
  const border =
    state === 'completed'
      ? '#D1FAE5'
      : state === 'active'
      ? '#FEF3C7'
      : '#E2E8F0';
  const textColor = state === 'upcoming' ? '#FFFFFF' : '#090D16';
  const ring = isBoarding
    ? 'box-shadow: 0 0 0 4px #38BDF8, 0 0 0 8px rgba(56, 189, 248, 0.3), 0 4px 12px rgba(0,0,0,0.45);'
    : state === 'active'
    ? 'box-shadow: 0 0 0 6px rgba(245, 158, 11, 0.35), 0 4px 12px rgba(0,0,0,0.45);'
    : 'box-shadow: 0 3px 10px rgba(0,0,0,0.45);';

  const label = state === 'completed' ? '✓' : String(order);

  return L.divIcon({
    className: 'custom-stop-marker',
    html: `
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background: ${bg};
        border: 2.5px solid ${border};
        color: ${textColor};
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        ${ring}
      ">${label}</div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
}

function createLeafletBusIcon(bus: Bus) {
  const statusColor =
    bus.status === 'Delayed'
      ? '#F59E0B'
      : bus.status === 'Arrived'
      ? '#0EA5E9'
      : '#10B981';

  return L.divIcon({
    className: 'custom-bus-marker',
    html: `
      <div style="position: relative; width: 46px; height: 46px; display: flex; align-items: center; justify-content: center;">
        <div class="bus-marker-radar" style="
          position: absolute;
          inset: 2px;
          border-radius: 9999px;
          background: ${statusColor};
          opacity: 0.45;
        "></div>
        <div style="
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          background: #090D16;
          border: 2.5px solid ${statusColor};
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 20px rgba(0,0,0,0.55);
          color: #FFFFFF;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${statusColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M8 6v6"/>
            <path d="M15 6v6"/>
            <path d="M2 12h19.6"/>
            <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
            <circle cx="7" cy="18" r="2"/>
            <path d="M9 18h5"/>
            <circle cx="16" cy="18" r="2"/>
          </svg>
        </div>
        <div style="
          position: absolute;
          top: -24px;
          left: 50%;
          transform: translateX(-50%);
          background: #090D16;
          color: #F8FAFC;
          border: 1.5px solid ${statusColor};
          padding: 2px 8px;
          border-radius: 6px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        ">${bus.bus_number}</div>
      </div>
    `,
    iconSize: [46, 46],
    iconAnchor: [23, 23],
    popupAnchor: [0, -24],
  });
}

function LeafletOsmMapView({
  bus,
  stops,
  boardingStopId,
  onSelectBoardingStop,
}: BusMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const lastBusIdRef = useRef<string | null>(null);
  const [followBus, setFollowBus] = useState(false);

  const activeIdx = bus ? getActiveStopIndex(bus, stops) : 0;

  const legendCounts = useMemo(() => {
    let completed = 0;
    let active = 0;
    let upcoming = 0;
    stops.forEach((_, idx) => {
      const state = getStopState(idx, activeIdx, bus?.status);
      if (state === 'completed') completed++;
      else if (state === 'active') active++;
      else upcoming++;
    });
    return { completed, active, upcoming };
  }, [stops, activeIdx, bus?.status]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [SHIVAMOGGA_CENTER.lat, SHIVAMOGGA_CENTER.lng],
      zoom: 13,
      zoomControl: true,
    });

    L.tileLayer(OSM_TILE_URL, {
      attribution: OSM_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
      routeLayerRef.current = null;
      busMarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = routeLayerRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    if (stops.length > 0) {
      const latLngs: L.LatLngExpression[] = stops.map((s) => [s.lat, s.lng]);

      L.polyline(latLngs, {
        color: '#0F172A',
        weight: 8,
        opacity: 0.78,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layerGroup);

      L.polyline(latLngs, {
        color: '#F59E0B',
        weight: 4,
        opacity: 0.95,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layerGroup);

      const completedEndIdx =
        bus?.status === 'Arrived' ? stops.length - 1 : Math.max(0, activeIdx);
      if (completedEndIdx >= 1) {
        L.polyline(latLngs.slice(0, completedEndIdx + 1), {
          color: '#10B981',
          weight: 4.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(layerGroup);
      }

      stops.forEach((stop, index) => {
        const state = getStopState(index, activeIdx, bus?.status);
        const isBoarding = stop.id === boardingStopId;

        const marker = L.marker([stop.lat, stop.lng], {
          icon: createLeafletStopIcon(stop.stop_order, state, isBoarding),
          zIndexOffset: state === 'active' ? 350 : isBoarding ? 300 : 120,
        }).addTo(layerGroup);

        const stateLabel =
          state === 'completed'
            ? 'Completed'
            : state === 'active'
            ? 'Active Stop'
            : 'Upcoming';
        const stateColor =
          state === 'completed'
            ? '#10B981'
            : state === 'active'
            ? '#F59E0B'
            : '#94A3B8';

        marker.bindPopup(
          `<div style="min-width: 175px; padding: 2px 0;">
            <div style="font-size: 11px; color: #94A3B8; font-family: 'JetBrains Mono', monospace;">
              Stop #${stop.stop_order} · ${stop.scheduled_time}
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #F8FAFC; margin-top: 3px;">
              ${stop.stop_name}
            </div>
            <div style="margin-top: 4px; font-size: 11px; font-weight: 600; color: ${stateColor};">
              Status: ${stateLabel}
            </div>
            ${
              isBoarding
                ? '<div style="margin-top: 4px; font-size: 11px; color: #38BDF8; font-weight: 600;">Selected Boarding Stop</div>'
                : '<div style="margin-top: 4px; font-size: 11px; color: #94A3B8;">Click pin to set as boarding stop</div>'
            }
          </div>`
        );

        marker.on('click', () => {
          onSelectBoardingStop(stop.id);
        });
      });
    }
  }, [stops, boardingStopId, activeIdx, bus?.status, onSelectBoardingStop]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !bus) return;

    const targetLatLng = L.latLng(bus.current_lat, bus.current_lng);
    const popupHtml = `
      <div style="min-width: 190px; padding: 2px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 13px; color: #FFFFFF;">${bus.bus_number}</span>
          <span style="font-size: 11px; font-weight: 600; color: ${
            bus.status === 'Delayed'
              ? '#F59E0B'
              : bus.status === 'Arrived'
              ? '#38BDF8'
              : '#10B981'
          };">${bus.status}</span>
        </div>
        <div style="font-size: 12px; color: #CBD5E1; margin-top: 4px;">${bus.route_name}</div>
        <div style="font-size: 11px; color: #94A3B8; margin-top: 6px; padding-top: 6px; border-top: 1px solid #1E293B; font-family: 'JetBrains Mono', monospace;">
          Next: ${bus.next_stop_name}<br/>
          ETA: ${bus.eta_minutes} min · ${bus.speed_kmh} km/h
        </div>
      </div>
    `;

    const busChanged = lastBusIdRef.current !== bus.id;
    lastBusIdRef.current = bus.id;

    if (!busMarkerRef.current) {
      const marker = L.marker(targetLatLng, {
        icon: createLeafletBusIcon(bus),
        zIndexOffset: 1000,
      }).addTo(map);
      marker.bindPopup(popupHtml);
      busMarkerRef.current = marker;
    } else {
      const marker = busMarkerRef.current;
      marker.setIcon(createLeafletBusIcon(bus));
      marker.setPopupContent(popupHtml);

      if (busChanged) {
        marker.setLatLng(targetLatLng);
      } else {
        const startLatLng = marker.getLatLng();
        if (
          Math.abs(startLatLng.lat - targetLatLng.lat) > 0.00001 ||
          Math.abs(startLatLng.lng - targetLatLng.lng) > 0.00001
        ) {
          if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
          const duration = 900;
          const startTime = performance.now();
          const step = (now: number) => {
            const progress = Math.min(1, (now - startTime) / duration);
            const eased = 1 - Math.pow(1 - progress, 3);
            marker.setLatLng([
              startLatLng.lat + (targetLatLng.lat - startLatLng.lat) * eased,
              startLatLng.lng + (targetLatLng.lng - startLatLng.lng) * eased,
            ]);
            if (progress < 1) animFrameRef.current = requestAnimationFrame(step);
          };
          animFrameRef.current = requestAnimationFrame(step);
        }
      }
    }

    if (busChanged) {
      const points: L.LatLngExpression[] = stops.map((s) => [s.lat, s.lng]);
      points.push([bus.current_lat, bus.current_lng]);
      if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
      } else {
        map.setView(targetLatLng, 14);
      }
    } else if (followBus) {
      map.panTo(targetLatLng, { animate: true, duration: 0.7 });
    }
  }, [bus, stops, followBus]);

  function handleRecenterRoute() {
    const map = mapRef.current;
    if (!map) return;
    const points: L.LatLngExpression[] = stops.map((s) => [s.lat, s.lng]);
    if (bus) points.push([bus.current_lat, bus.current_lng]);
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
    } else if (bus) {
      map.setView([bus.current_lat, bus.current_lng], 14);
    } else {
      map.setView([SHIVAMOGGA_CENTER.lat, SHIVAMOGGA_CENTER.lng], 13);
    }
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-800/90 bg-[#0B1120]">
      <div className="relative w-full h-[440px] sm:h-[520px] lg:h-[540px]">
        <div ref={containerRef} className="w-full h-full" />

        <div className="absolute top-3 right-3 z-[400] flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFollowBus((prev) => !prev);
              if (!followBus && bus && mapRef.current) {
                mapRef.current.panTo([bus.current_lat, bus.current_lng], {
                  animate: true,
                });
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium backdrop-blur-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-md ${
              followBus
                ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                : 'bg-[#090D16]/90 text-slate-100 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Follow Bus</span>
          </button>

          <button
            type="button"
            onClick={handleRecenterRoute}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#090D16]/90 hover:bg-slate-800 text-slate-100 backdrop-blur-md border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-md"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>Fit Route</span>
          </button>
        </div>
      </div>

      {/* Clear Color-Coded Stop Legend */}
      <RouteStopLegend
        completedCount={legendCounts.completed}
        activeCount={legendCounts.active}
        upcomingCount={legendCounts.upcoming}
        hasBoardingStop={Boolean(boardingStopId)}
        mapProviderLabel="OSM Street"
      />
    </div>
  );
}

export function BusMap(props: BusMapProps) {
  if (GOOGLE_MAPS_API_KEY) {
    return <GoogleBusMapView {...props} />;
  }
  return <LeafletOsmMapView {...props} />;
}
