import * as https from 'https';
import {
  IncidentsResponse,
  Incident,
  StatusSnapshot,
  SummaryResponse,
  TodaysUpdate,
} from './types';

const DEFAULT_STATUS_URL = 'https://status.cursor.com';

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const request = https.get(url, { headers: { Accept: 'application/json' } }, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        fetchJson<T>(response.headers.location).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode ?? 'unknown'} for ${url}`));
        response.resume();
        return;
      }

      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => chunks.push(chunk));
      response.on('end', () => {
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T);
        } catch (error) {
          reject(error);
        }
      });
    });

    request.on('error', reject);
    request.setTimeout(15_000, () => {
      request.destroy(new Error(`Timeout while fetching ${url}`));
    });
  });
}

function isSameUtcDay(isoDate: string, reference: Date): boolean {
  const date = new Date(isoDate);
  return (
    date.getUTCFullYear() === reference.getUTCFullYear() &&
    date.getUTCMonth() === reference.getUTCMonth() &&
    date.getUTCDate() === reference.getUTCDate()
  );
}

function incidentTouchesToday(incident: Incident, today: Date): boolean {
  if (isSameUtcDay(incident.created_at, today) || isSameUtcDay(incident.updated_at, today)) {
    return true;
  }

  return incident.incident_updates.some((update) => isSameUtcDay(update.display_at || update.created_at, today));
}

function collectTodaysUpdates(incidents: Incident[], today: Date): TodaysUpdate[] {
  const updates: TodaysUpdate[] = [];

  for (const incident of incidents) {
    for (const update of incident.incident_updates) {
      const timestamp = update.display_at || update.created_at;
      if (!isSameUtcDay(timestamp, today)) {
        continue;
      }

      updates.push({
        incidentName: incident.name,
        status: update.status,
        body: update.body.trim(),
        time: formatUtcTime(timestamp),
        incidentUrl: incident.shortlink,
      });
    }
  }

  return updates.sort((a, b) => a.time.localeCompare(b.time));
}

function formatUtcTime(isoDate: string): string {
  const date = new Date(isoDate);
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes} UTC`;
}

function uniqueIncidents(incidents: Incident[]): Incident[] {
  const seen = new Set<string>();
  const result: Incident[] = [];

  for (const incident of incidents) {
    if (seen.has(incident.id)) {
      continue;
    }
    seen.add(incident.id);
    result.push(incident);
  }

  return result;
}

export async function fetchStatusSnapshot(statusPageUrl = DEFAULT_STATUS_URL): Promise<StatusSnapshot> {
  const baseUrl = statusPageUrl.replace(/\/$/, '');
  const today = new Date();

  const [summary, recentIncidents] = await Promise.all([
    fetchJson<SummaryResponse>(`${baseUrl}/api/v2/summary.json`),
    fetchJson<IncidentsResponse>(`${baseUrl}/api/v2/incidents.json?per_page=25`),
  ]);

  const relevantIncidents = uniqueIncidents([
    ...summary.incidents,
    ...summary.scheduled_maintenances,
    ...recentIncidents.incidents.filter((incident) => incidentTouchesToday(incident, today)),
  ]);

  const activeIncidents = summary.incidents.filter((incident) => incident.status !== 'resolved');
  const todaysUpdates = collectTodaysUpdates(relevantIncidents, today);

  return {
    description: summary.status.description,
    indicator: summary.status.indicator,
    pageUrl: summary.page.url,
    updatedAt: summary.page.updated_at,
    activeIncidents,
    todaysUpdates,
  };
}
