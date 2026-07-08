export type StatusIndicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance';

export interface PageInfo {
  id: string;
  name: string;
  url: string;
  time_zone: string;
  updated_at: string;
}

export interface StatusInfo {
  indicator: StatusIndicator;
  description: string;
}

export interface IncidentUpdate {
  id: string;
  status: string;
  body: string;
  created_at: string;
  display_at: string;
}

export interface Incident {
  id: string;
  name: string;
  status: string;
  impact: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  shortlink: string;
  incident_updates: IncidentUpdate[];
}

export interface SummaryResponse {
  page: PageInfo;
  status: StatusInfo;
  incidents: Incident[];
  scheduled_maintenances: Incident[];
}

export interface IncidentsResponse {
  page: PageInfo;
  incidents: Incident[];
}

export interface StatusSnapshot {
  description: string;
  indicator: StatusIndicator;
  pageUrl: string;
  updatedAt: string;
  activeIncidents: Incident[];
  todaysUpdates: TodaysUpdate[];
}

export interface TodaysUpdate {
  incidentName: string;
  status: string;
  body: string;
  time: string;
  incidentUrl: string;
}
