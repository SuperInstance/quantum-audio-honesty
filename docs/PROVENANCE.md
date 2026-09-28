# Provenance

Extracted 2026-09-28 (kimi1 snowball lane) from **SuperInstance/pong-quilt
`qa.js`** @ commit `b4d15c8` (R54 tip) — the L2 quantum-audio waveform-imaging
advisor. Extraction directive: Kimi "bicycle maker" order (2026-09-28 13:34 CST,
via lanes/extraction/INVENTORY.md): pull pong-quilt's embedded novel tech into
standalone modules outsiders can adopt and develop.

## What was ported, faithfully

Everything except the page-coupled doctor-lens seam (pong-quilt R27's
`setDoctorLens`/`lensSuffix` — a stat-line rendering hook, not channel tech):

- `sonify` / `channel` / `estimateX` / `zeroCrossingRate` / `suggest` —
  verbatim logic, including the Round-13 `??`-not-`||` empty-pot semantics.
- `confidenceEnvelope` — cached 9×9-grid measurement (default grid preserved;
  grid now injectable).
- `shotBins` / `toB64` / `suggestByo` — the BYO wire seam. Pong-quilt kept
  `shotBins`/`toB64`/`isJevValid` private; the extraction exports `shotBins`
  and `toB64` (they ARE the wire format) and makes the reply validator an
  injectable option (default = pong-quilt's `isJevValid`).

## Generalizations made (and only these)

1. The rng (pong-quilt `core.js` LCG family) is a default, injectable via
   `makeHonestyChannel({ rng })`. Default reproduces pong-quilt's seeded
   numbers bit-for-bit (faithful-port pins).
2. `sonify`, `validateReply`, `N`, `deadzone`, `envelopeGrid` injectable.
3. No `core.js` dependency — the module is fully standalone (zero-dep).

## Known warts carried from the source (documented, not silently fixed)

- The stand-in's noise model is sized from one QPAM measurement
  (pong-quilt `research/2026-09-24-quantum-audio-L2.md`), not derived.
- The estimator searches lags 5..16 — tones outside 4..12 cycles/frame
  image back badly. Inject your own `sonify` for other domains.
- Sibling ports of the REAL pipeline exist: `SuperInstance/quilt-quantumaudio-demo`
  (QPAM encode/decode + honest `[no-quantumaudio:...]` fallback) and
  `SuperInstance/quilt-echovision` (sonify → lossy channel → image it back).
  This module consolidates the *channel seam*; it does not duplicate the rig.

## Referral edges (fleet weight law — named at first commit)

- `quantum-audio-honesty -> pq-l2` (source: pong-quilt qa.js, this port's parent)
- `quantum-audio-honesty -> qad-qpam` (sibling real-QPAM rig: quilt-quantumaudio-demo)
- `quantum-audio-honesty -> qad-echovision` (sibling echovision port)

A merged PR in a target repo citing this module mints the edge VERIFIED=1.0.
