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

// ── Search connections FROM → TO (the main search) ──────────────────────────
// GET /connections?fromId=8100070&toId=8100072&date=2024-01-05
app.get('/connections', async (req, res) => {
  try {
    const { fromId, toId, date } = req.query;
    if (!fromId || !toId) return res.status(400).json({ error: 'fromId and toId required' });

    // Use today or provided date, search from start of day
    const when = date ? new Date(date + 'T04:00:00') : new Date();
    when.setHours(4, 0, 0, 0); // from 4am

    const result = await client.journeys(fromId, toId, {
      results: 12,
      departure: when,
      stopovers: true,
      remarks: false,
    });

    const connections = result.journeys
      .filter(j => j.legs && j.legs.length > 0)
      .map(j => {
        const leg = j.legs[0]; // direct connection, first leg
        const allLegs = j.legs;

        // Collect all stopovers across all legs
        const stops = [];
        allLegs.forEach(l => {
          (l.stopovers || []).forEach((s, i) => {
            // avoid duplicating transfer stations
            const name = s.stop?.name || '';
            if (!stops.length || stops[stops.length-1].name !== name) {
              stops.push({
                name,
                plannedArrival:   s.plannedArrival   || null,
                plannedDeparture: s.plannedDeparture || null,
                arrivalDelay:     s.arrivalDelay     ?? 0,
                departureDelay:   s.departureDelay   ?? 0,
                cancelled:        s.cancelled        ?? false,
              });
            }
          });
        });

        const firstLeg = allLegs[0];
        const lastLeg  = allLegs[allLegs.length - 1];

        return {
          tripId:        firstLeg.tripId || null,
          lineName:      firstLeg.line?.name || '',
          direction:     firstLeg.direction || '',
          plannedDep:    firstLeg.plannedDeparture,
          dep:           firstLeg.departure,
          depDelay:      firstLeg.departureDelay ?? 0,
          plannedArr:    lastLeg.plannedArrival,
          arr:           lastLeg.arrival,
          arrDelay:      lastLeg.arrivalDelay ?? 0,
          cancelled:     j.legs.some(l => l.cancelled),
          transfers:     j.legs.length - 1,
          stops,
        };
      });

    res.json(connections);
  } catch (err) {
    console.error('connections error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get live departures from a station (for refresh) ────────────────────────
// GET /departures?stationId=8100070&duration=120
app.get('/departures', async (req, res) => {
  try {
    const { stationId, duration = 180 } = req.query;
    if (!stationId) return res.status(400).json({ error: 'stationId required' });

    const result = await client.departures(stationId, {
      duration: parseInt(duration),
      results: 30,
      stopovers: false,
      remarks: false,
    });

    const departures = result.departures.map(d => ({
      tripId:      d.tripId,
      line:        d.line?.name || '',
      direction:   d.direction || '',
      plannedWhen: d.plannedWhen,
      when:        d.when,
      delay:       d.delay ?? 0,   // seconds
      cancelled:   d.cancelled ?? false,
      platform:    d.plannedPlatform || d.platform || null,
    }));

    res.json(departures);
  } catch (err) {
    console.error('departures error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Get live stopovers for a saved trip (for live tracking) ─────────────────
// GET /trip?tripId=...&lineName=S8
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

// ── Known stations shortcut ──────────────────────────────────────────────────
app.get('/stations/known', (req, res) => {
  res.json([
    { id: '8100070', name: 'Leoben Hbf' },
    { id: '8100071', name: 'St.Michael i.Oststmk' },
    { id: '8100072', name: 'Knittelfeld' },
    { id: '8100059', name: 'Bruck/Mur Hbf' },
    { id: '8100173', name: 'Graz Hbf' },
  ]);
});

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.json({ status: 'ok', service: 'train-tracker-api' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`train-tracker-api running on port ${PORT}`));
