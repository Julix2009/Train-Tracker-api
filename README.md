# train-tracker-api

Kleiner Express-Server der ÖBB Live-Daten via `hafas-client` bereitstellt.  
Kein API-Key nötig — hafas-client spricht den öffentlichen ÖBB-Endpunkt an.

## Endpoints

| Endpoint | Parameter | Beschreibung |
|----------|-----------|--------------|
| `GET /stations` | `?query=Knittelfeld` | Bahnhöfe suchen |
| `GET /departures` | `?stationId=8100173&duration=120` | Abfahrten einer Station |
| `GET /trip` | `?tripId=...&lineName=REX 1820` | Live-Halte eines Zuges |

## Deploy auf Render.com

1. Dieses Repo auf GitHub hochladen
2. Auf [render.com](https://render.com) → New → Web Service
3. GitHub Repo verbinden
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Free Plan auswählen → Deploy

## Lokal testen

```bash
npm install
npm start
# läuft auf http://localhost:3000
```
