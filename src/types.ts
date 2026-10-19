export type StatusIndicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance';

export interface IncidentUpdate {
  status: string;
  body: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  name: string;
  components: string[];
  status: string;
  severity: string;
  createdAt: string;
  url: string;
  updates: IncidentUpdate[];
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
