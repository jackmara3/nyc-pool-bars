# NYC Pool Bars

Interactive map of pool bars in Manhattan, Brooklyn, Jersey City, and Hoboken.

## Run locally

Serve the project over HTTP (required for loading `bars.json`):

```bash
cd nyc-pool-bars
npx serve .
```

Then open **http://localhost:3000** (or the URL printed by `serve`).

Alternatively: `python3 -m http.server 8080` then open **http://localhost:8080**.

## Updating bar data

Edit **`bars.json`**. Each bar has:

- **`id`** — unique string (e.g. `"amsterdam-billiards"`)
- **`name`** — display name
- **`neighborhood`** — e.g. Upper West Side, Williamsburg
- **`address`** — full address
- **`tableCount`** — number of tables
- **`price`** — e.g. `"$12/hour"` or `"$8/game"`
- **`priceType`** — `"per hour"` or `"per game"`
- **`lat`**, **`lng`** — coordinates for the map pin
- **`ratings`** — 1–5 for each:
  - `tableQuality`, `competitionLevel`, `atmosphere`, `elbowRoom`, `waitTime`, `cueQuality`

Overall score is computed as the average of all six ratings. Add or remove entries in the `bars` array as needed.
