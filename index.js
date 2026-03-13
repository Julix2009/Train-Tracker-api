import express from 'express';
import cors from 'cors';
import { createClient } from 'hafas-client';
import { profile as obbProfile } from 'hafas-client/p/oebb/index.js';

const client = createClient(obbProfile, 'train-tracker-app');
const app = express();

app.use(cors());
app.use(express.json());

// ── Search stations by name ──────────────────────────────────────────────────
// GET /stations?query=Knittelfeld
app.get('/stations', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.length < 2) return res.json([]);
    const results = await client.locations(query, { results: 8, stops: true, addresses: false, poi: false });
    const stations = results
      .filter(r => r.type === 'stop' || r.type === 'station')
      .map(s => ({ id: s.id, name: s.name }));
    res.json(stations);
  } catch (err) {
    console.error('stations error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get departures from a station ───────────────────────────────────────────
// GET /departures?stationId=8100173&duration=120
app.get('/departures', async (req, res) => {
  try {
    const { stationId, duration = 120 } = req.query;
    if (!stationId) return res.status(400).json({ error: 'stationId required' });

    const result = await client.departures(stationId, {
      duration: parseInt(duration),
      results: 20,
      stopovers: false,
      remarks: false,
    });

    const departures = result.departures.map(d => ({
      tripId:      d.tripId,
      line:        d.line?.name || '',
      direction:   d.direction || '',
      plannedWhen: d.plannedWhen,
      when:        d.when,
      delay:       d.delay ?? 0,        // seconds
      cancelled:   d.cancelled ?? false,
      platform:    d.plannedPlatform || d.platform || null,
    }));

    res.json(departures);
  } catch (err) {
    console.error('departures error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get live stopovers for a specific trip ───────────────────────────────────
// GET /trip?tripId=...&lineName=REX%201820
app.get('/trip', async (req, res) => {
  try {
    const { tripId, lineName } = req.query;
    if (!tripId) return res.status(400).json({ error: 'tripId required' });

    const result = await client.trip(tripId, lineName || '', { stopovers: true, remarks: false });
    const trip = result.trip || result;

    const stopovers = (trip.stopovers || []).map(s => ({
      stop:             s.stop?.name || '',
      plannedArrival:   s.plannedArrival,
      arrival:          s.arrival,
      arrivalDelay:     s.arrivalDelay ?? 0,
      plannedDeparture: s.plannedDeparture,
      departure:        s.departure,
      departureDelay:   s.departureDelay ?? 0,
      cancelled:        s.cancelled ?? false,
    }));

    res.json({ stopovers });
  } catch (err) {
    console.error('trip error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'train-tracker-api' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`train-tracker-api running on port ${PORT}`));
