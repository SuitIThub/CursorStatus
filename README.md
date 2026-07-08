# Cursor Status

VS Code / Cursor-Erweiterung, die den aktuellen Systemstatus von [Cursor](https://cursor.com) in der IDE-Statusleiste anzeigt.

Datenquelle: [status.cursor.com](https://status.cursor.com) (Atlassian Statuspage API).

## Funktionen

- **Statusleiste** – zeigt den aktuellen Gesamtstatus mit passendem Icon an
- **Hover-Tooltip** – listet aktive Störungen und alle Updates vom heutigen Tag (UTC)
- **Klick** – öffnet die offizielle Statusseite im Browser
- **Auto-Refresh** – periodische Aktualisierung im Hintergrund (standardmäßig alle 5 Minuten)

### Status-Anzeige

| Zustand | Icon | Bedeutung |
| --- | --- | --- |
| Operational | ✓ | Alle Systeme betriebsbereit |
| Minor | ⚠ | Geringfügige Beeinträchtigung |
| Maintenance | 🔧 | Geplante Wartung |
| Major / Critical | ✕ | Teilausfall oder schwerer Ausfall |

## Installation

### Aus VSIX (empfohlen)

1. Die Datei `cursor-status-0.1.1.vsix` installieren:
   - **Command Palette** (`Ctrl+Shift+P`) → `Extensions: Install from VSIX…`
   - oder per Terminal:
     ```bash
     cursor --install-extension cursor-status-0.1.1.vsix
     ```
2. Cursor / VS Code neu laden.

### Aus dem Quellcode

```bash
npm install
npm run compile
npm run package
```

Die erzeugte `.vsix`-Datei kann anschließend installiert werden.

## Konfiguration

| Einstellung | Standard | Beschreibung |
| --- | --- | --- |
| `cursorStatus.refreshIntervalMinutes` | `5` | Aktualisierungsintervall in Minuten (1–60) |
| `cursorStatus.statusPageUrl` | `https://status.cursor.com` | Basis-URL der Statusseite |

Beispiel in `settings.json`:

```json
{
  "cursorStatus.refreshIntervalMinutes": 10
}
```

## Entwicklung

```bash
npm install
npm run watch    # TypeScript im Watch-Modus
npm run compile  # Einmalig kompilieren
npm run package  # VSIX erstellen
```

Zum Debuggen in VS Code / Cursor: Ordner öffnen und mit **F5** eine Extension Development Host-Instanz starten (optional `launch.json` anlegen).

## Lizenz

MIT – siehe die Datei `LICENSE` im Projektroot.
