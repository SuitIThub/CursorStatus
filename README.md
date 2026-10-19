# Cursor Status

VS Code / Cursor extension that displays the current system status of [Cursor](https://cursor.com) in the IDE status bar.

Data source: the RSS feed of [status.x.ai](https://status.x.ai) ([`feed.xml`](https://status.x.ai/feed.xml)). Since October 26, 2026, Cursor status updates are published there instead of on status.cursor.com. The feed covers all xAI services, so the extension only considers incidents whose component, title or link contains `cursor` (configurable).

## Features

- **Status bar** – shows the current overall status with a matching icon
- **Hover tooltip** – lists active incidents and all updates from today (UTC)
- **Click** – opens the official status page in your browser
- **Auto-refresh** – periodic background updates (every 5 minutes by default)

### Status indicators

| State | Icon | Meaning |
| --- | --- | --- |
| Operational | ✓ | All systems operational |
| Minor | ⚠ | Active incident with severity `disruption` |
| Maintenance | 🔧 | Scheduled maintenance |
| Major | ✕ | Active incident with severity `outage` |

## Installation

### From VSIX (recommended)

1. Install `cursor-status-1.1.0.vsix`:
   - **Command Palette** (`Ctrl+Shift+P`) → `Extensions: Install from VSIX…`
   - or via terminal:
     ```bash
     cursor --install-extension cursor-status-1.1.0.vsix
     ```
2. Reload Cursor / VS Code.

### From source

```bash
npm install
npm run compile
npm run package
```

Install the generated `.vsix` file afterwards.

## Configuration

| Setting | Default | Description |
| --- | --- | --- |
| `cursorStatus.refreshIntervalMinutes` | `5` | Refresh interval in minutes (1–60) |
| `cursorStatus.statusPageUrl` | `https://status.x.ai` | Status page opened on click |
| `cursorStatus.feedUrl` | `https://status.x.ai/feed.xml` | RSS feed the status is read from |
| `cursorStatus.componentFilter` | `cursor` | Only incidents whose component, title or link contains this text (case-insensitive); empty = all incidents in the feed |

Example in `settings.json`:

```json
{
  "cursorStatus.refreshIntervalMinutes": 10
}
```

## Development

```bash
npm install
npm run watch    # TypeScript in watch mode
npm run compile  # One-off compile
npm run package  # Create VSIX
```

To debug in VS Code / Cursor: open the folder and press **F5** to launch an Extension Development Host (optionally add a `launch.json`).

## License

MIT – see the `LICENSE` file in the project root.
