# Load Test Evidence

Artifacts generated against the live Docker Compose stack.

| File | Purpose |
| --- | --- |
| `results.json` | Raw autocannon metrics |
| `report.html` | Visual evidence page |
| `screenshot-report-hero.png` | Hero screenshot for README |
| `screenshot-report-full.png` | Full-page report screenshot |
| `screenshot-live-status.png` | Post-load `/health` + `/ready` |
| `screenshot-health.png` | Live `/health` JSON |

Regenerate:

```bash
npm run load:test
npm run load:report
```
