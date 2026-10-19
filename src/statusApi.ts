import * as https from 'https';
import { Incident, IncidentUpdate, StatusIndicator, StatusSnapshot, TodaysUpdate } from './types';

export const DEFAULT_FEED_URL = 'https://status.x.ai/feed.xml';
export const DEFAULT_STATUS_PAGE_URL = 'https://status.x.ai';
export const DEFAULT_COMPONENT_FILTER = 'cursor';

const INACTIVE_STATUSES = new Set(['resolved', 'completed', 'postmortem']);

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = https.get(
      url,
      { headers: { Accept: 'application/rss+xml, application/xml, text/xml', 'User-Agent': 'cursor-status-extension' } },
      (response) => {
        if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          response.resume();
          fetchText(new URL(response.headers.location, url).toString()).then(resolve).catch(reject);
          return;
        }

        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode ?? 'unknown'} for ${url}`));
          response.resume();
          return;
        }

        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      },
    );

    request.on('error', reject);
    request.setTimeout(15_000, () => {
      request.destroy(new Error(`Timeout while fetching ${url}`));
    });
  });
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function readTag(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`).exec(xml);
  if (!match) {
    return '';
  }
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(match[1]);
  return cdata ? cdata[1] : decodeEntities(match[1]).trim();
}

function readAllTags(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'g');
  return Array.from(xml.matchAll(pattern), (match) => decodeEntities(match[1]).trim());
}

function toIsoDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

// Item descriptions look like:
// <h3>Status: RESOLVED</h3><p>Severity: outage</p>...<div><p><strong>DATE</strong></p><h3>Investigating</h3><p>BODY</p></div>
function parseUpdates(descriptionHtml: string): IncidentUpdate[] {
  const updates: IncidentUpdate[] = [];
  const pattern = /<div>\s*<p>\s*<strong>([\s\S]*?)<\/strong>\s*<\/p>\s*<h3>([\s\S]*?)<\/h3>([\s\S]*?)<\/div>/g;

  for (const match of descriptionHtml.matchAll(pattern)) {
    const createdAt = toIsoDate(stripHtml(match[1]));
    if (!createdAt) {
      continue;
    }
    updates.push({
      createdAt,
      status: stripHtml(match[2]).toLowerCase(),
      body: stripHtml(match[3]),
    });
  }

  return updates;
}

function parseItem(itemXml: string): Incident | undefined {
  const rawTitle = readTag(itemXml, 'title');
  const titleMatch = /^\[([^\]]+)\]\s*(.*)$/.exec(rawTitle);
  const component = titleMatch ? titleMatch[1].trim() : '';
  const name = titleMatch ? titleMatch[2].trim() : rawTitle;
  const url = readTag(itemXml, 'link');
  const id = readTag(itemXml, 'guid') || url || rawTitle;
  const description = readTag(itemXml, 'description');

  if (!name) {
    return undefined;
  }

  const statusMatch = /Status:\s*([^<]+)/i.exec(description);
  const severityMatch = /Severity:\s*([^<]+)/i.exec(description);
  const categories = readAllTags(itemXml, 'category').map((category) => category.toLowerCase());
  const updates = parseUpdates(description);

  return {
    id,
    name,
    components: component ? [component] : [],
    status: (statusMatch?.[1] ?? categories[1] ?? updates[0]?.status ?? 'unknown').trim().toLowerCase(),
    severity: (severityMatch?.[1] ?? categories[0] ?? '').trim().toLowerCase(),
    createdAt: toIsoDate(readTag(itemXml, 'pubDate')),
    url,
    updates,
  };
}

/** The feed lists one item per affected component; merge them by guid. */
function mergeIncidents(incidents: Incident[]): Incident[] {
  const byId = new Map<string, Incident>();

  for (const incident of incidents) {
    const existing = byId.get(incident.id);
    if (!existing) {
      byId.set(incident.id, { ...incident, components: [...incident.components] });
      continue;
    }
    for (const component of incident.components) {
      if (!existing.components.includes(component)) {
        existing.components.push(component);
      }
    }
  }

  return Array.from(byId.values());
}

function matchesFilter(incident: Incident, filter: string): boolean {
  if (!filter) {
    return true;
  }
  const needle = filter.toLowerCase();
  return [...incident.components, incident.name, incident.url].some((value) => value.toLowerCase().includes(needle));
}

function isActive(incident: Incident): boolean {
  return !INACTIVE_STATUSES.has(incident.status);
}

function severityToIndicator(severity: string): StatusIndicator {
  if (severity.includes('maintenance')) {
    return 'maintenance';
  }
  if (severity.includes('outage')) {
    return 'major';
  }
  return 'minor';
}

const INDICATOR_RANK: Record<StatusIndicator, number> = { none: 0, maintenance: 1, minor: 2, major: 3, critical: 4 };

const INDICATOR_DESCRIPTION: Record<StatusIndicator, string> = {
  none: 'All Systems Operational',
  maintenance: 'Service Under Maintenance',
  minor: 'Minor Service Disruption',
  major: 'Partial System Outage',
  critical: 'Major System Outage',
};

function isSameUtcDay(isoDate: string, reference: Date): boolean {
  const date = new Date(isoDate);
  return (
    date.getUTCFullYear() === reference.getUTCFullYear() &&
    date.getUTCMonth() === reference.getUTCMonth() &&
    date.getUTCDate() === reference.getUTCDate()
  );
}

function collectTodaysUpdates(incidents: Incident[], today: Date): TodaysUpdate[] {
  const updates: TodaysUpdate[] = [];

  for (const incident of incidents) {
    for (const update of incident.updates) {
      if (!isSameUtcDay(update.createdAt, today)) {
        continue;
      }

      updates.push({
        incidentName: incident.name,
        status: update.status,
        body: update.body,
        time: formatUtcTime(update.createdAt),
        incidentUrl: incident.url,
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

export async function fetchStatusSnapshot(
  feedUrl = DEFAULT_FEED_URL,
  statusPageUrl = DEFAULT_STATUS_PAGE_URL,
  componentFilter = DEFAULT_COMPONENT_FILTER,
): Promise<StatusSnapshot> {
  const xml = await fetchText(feedUrl);
  if (!/<rss[\s>]/.test(xml) && !/<channel[\s>]/.test(xml)) {
    throw new Error(`Keine gültige RSS-Antwort von ${feedUrl}`);
  }

  const today = new Date();
  const items = Array.from(xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/g), (match) => parseItem(match[1]));
  const incidents = mergeIncidents(items.filter((item): item is Incident => item !== undefined)).filter((incident) =>
    matchesFilter(incident, componentFilter.trim()),
  );

  const activeIncidents = incidents.filter(isActive);
  const indicator = activeIncidents
    .map((incident) => severityToIndicator(incident.severity))
    .reduce<StatusIndicator>((worst, current) => (INDICATOR_RANK[current] > INDICATOR_RANK[worst] ? current : worst), 'none');

  return {
    description: INDICATOR_DESCRIPTION[indicator],
    indicator,
    pageUrl: statusPageUrl,
    updatedAt: today.toISOString(),
    activeIncidents,
    todaysUpdates: collectTodaysUpdates(incidents, today),
  };
}
