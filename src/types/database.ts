export type UserRole = 'student' | 'driver' | 'admin';

export type BusStatus = 'On Time' | 'Delayed' | 'Arrived' | 'Not Started';

export type AlertType = 'info' | 'warning' | 'arrival';

export interface Profile {
  id: string;
  full_name: string;
  usn_or_staff_id: string;
  role: UserRole;
}

export interface Bus {
  id: string;
  bus_number: string;
  route_name: string;
  driver_name: string;
  driver_phone: string;
  current_lat: number;
  current_lng: number;
  speed_kmh: number;
  status: BusStatus;
  next_stop_name: string;
  eta_minutes: number;
  updated_at: string;
}

export interface Stop {
  id: string;
  bus_id: string;
  stop_name: string;
  stop_order: number;
  lat: number;
  lng: number;
  scheduled_time: string;
}

export interface NotificationItem {
  id: string;
  bus_id: string;
  title: string;
  message: string;
  alert_type: AlertType;
  created_at: string;
}
