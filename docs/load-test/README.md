# Load Test Evidence

Artifacts generated against the live Docker Compose stack.

## HTTP (autocannon)

| File | Purpose |
| --- | --- |
| `results.json` | Raw autocannon metrics |
| `report.html` | Visual evidence page |
| `screenshot-report-hero.png` | Hero screenshot for README |
| `screenshot-report-full.png` | Full-page report screenshot |
| `screenshot-live-status.png` | Post-load `/health` + `/ready` |
| `screenshot-health.png` | Live `/health` JSON |

```bash
npm run load:test
npm run load:report
```

## WebSocket game sessions

| File | Purpose |
| --- | --- |
| `ws-results.json` | Raw concurrent-session metrics |
| `ws-report.html` | Visual evidence page |
| `screenshot-ws-report-hero.png` | Hero screenshot for README |
| `screenshot-ws-report-full.png` | Full-page WS report screenshot |

```bash
npm run load:ws
npm run load:ws-report
```
