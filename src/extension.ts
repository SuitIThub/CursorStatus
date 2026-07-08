import * as vscode from 'vscode';
import { fetchStatusSnapshot } from './statusApi';
import { StatusIndicator, StatusSnapshot } from './types';

const STATUS_COMMAND = 'cursorStatus.openStatusPage';
const REFRESH_COMMAND = 'cursorStatus.refresh';

let statusBarItem: vscode.StatusBarItem | undefined;
let refreshTimer: NodeJS.Timeout | undefined;
let lastSnapshot: StatusSnapshot | undefined;

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 50);
  statusBarItem.name = 'Cursor Status';
  statusBarItem.command = STATUS_COMMAND;
  statusBarItem.show();

  context.subscriptions.push(
    statusBarItem,
    vscode.commands.registerCommand(STATUS_COMMAND, openStatusPage),
    vscode.commands.registerCommand(REFRESH_COMMAND, () => refreshStatus(true)),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration('cursorStatus')) {
        scheduleRefresh();
        void refreshStatus(false);
      }
    }),
  );

  scheduleRefresh();
  void refreshStatus(false);
}

export function deactivate(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = undefined;
  }
  statusBarItem?.dispose();
  statusBarItem = undefined;
}

function scheduleRefresh(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  const minutes = vscode.workspace.getConfiguration('cursorStatus').get<number>('refreshIntervalMinutes', 5);
  const intervalMs = Math.max(1, minutes) * 60_000;
  refreshTimer = setInterval(() => {
    void refreshStatus(false);
  }, intervalMs);
}

async function refreshStatus(manual: boolean): Promise<void> {
  if (!statusBarItem) {
    return;
  }

  const config = vscode.workspace.getConfiguration('cursorStatus');
  const statusPageUrl = config.get<string>('statusPageUrl', 'https://status.cursor.com');

  if (!lastSnapshot) {
    statusBarItem.text = '$(sync~spin) Cursor';
    statusBarItem.tooltip = 'Cursor-Status wird geladen…';
  }

  try {
    const snapshot = await fetchStatusSnapshot(statusPageUrl);
    lastSnapshot = snapshot;
    applySnapshot(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    statusBarItem.text = '$(warning) Cursor';
    statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    statusBarItem.tooltip = buildErrorTooltip(message, statusPageUrl);

    if (manual) {
      void vscode.window.showErrorMessage(`Cursor Status konnte nicht geladen werden: ${message}`);
    }
  }
}

function applySnapshot(snapshot: StatusSnapshot): void {
  if (!statusBarItem) {
    return;
  }

  const { icon, background } = indicatorStyle(snapshot.indicator);
  statusBarItem.text = `${icon} Cursor`;
  statusBarItem.backgroundColor = background;
  statusBarItem.tooltip = buildTooltip(snapshot);
}

function indicatorStyle(indicator: StatusIndicator): {
  icon: string;
  background: vscode.ThemeColor | undefined;
} {
  switch (indicator) {
    case 'none':
      return { icon: '$(check)', background: undefined };
    case 'minor':
      return { icon: '$(warning)', background: new vscode.ThemeColor('statusBarItem.warningBackground') };
    case 'maintenance':
      return { icon: '$(tools)', background: new vscode.ThemeColor('statusBarItem.warningBackground') };
    case 'major':
    case 'critical':
      return { icon: '$(error)', background: new vscode.ThemeColor('statusBarItem.errorBackground') };
    default:
      return { icon: '$(question)', background: undefined };
  }
}

function buildTooltip(snapshot: StatusSnapshot): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString('', true);
  tooltip.isTrusted = true;
  tooltip.supportHtml = false;

  tooltip.appendMarkdown(`**Cursor Status:** ${snapshot.description}\n\n`);

  if (snapshot.activeIncidents.length > 0) {
    tooltip.appendMarkdown('**Aktive Störungen**\n\n');
    for (const incident of snapshot.activeIncidents) {
      tooltip.appendMarkdown(`- **${incident.name}** (${incident.status})\n`);
    }
    tooltip.appendMarkdown('\n');
  }

  tooltip.appendMarkdown('**Heute**\n\n');
  if (snapshot.todaysUpdates.length === 0) {
    tooltip.appendMarkdown('_Keine Vorfälle oder Updates für heute._\n\n');
  } else {
    for (const update of snapshot.todaysUpdates) {
      tooltip.appendMarkdown(
        `- **${update.time}** · ${update.incidentName} (${update.status})\n  ${update.body}\n`,
      );
    }
    tooltip.appendMarkdown('\n');
  }

  const updatedAt = new Date(snapshot.updatedAt).toLocaleString('de-DE', { timeZone: 'UTC' });
  tooltip.appendMarkdown(`_Zuletzt aktualisiert: ${updatedAt} UTC_\n\n`);
  tooltip.appendMarkdown(`[Statusseite öffnen](${snapshot.pageUrl})`);

  return tooltip;
}

function buildErrorTooltip(message: string, statusPageUrl: string): vscode.MarkdownString {
  const tooltip = new vscode.MarkdownString('', true);
  tooltip.isTrusted = true;
  tooltip.appendMarkdown(`**Cursor Status konnte nicht geladen werden**\n\n${message}\n\n`);
  tooltip.appendMarkdown(`[Statusseite öffnen](${statusPageUrl})`);
  return tooltip;
}

function openStatusPage(): void {
  const statusPageUrl =
    lastSnapshot?.pageUrl ??
    vscode.workspace.getConfiguration('cursorStatus').get<string>('statusPageUrl', 'https://status.cursor.com');
  void vscode.env.openExternal(vscode.Uri.parse(statusPageUrl));
}
