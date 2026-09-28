# quantum-audio-honesty

Zero-dependency **waveform-imaging honesty channel**: sonify a state → push it
through a lossy (quantum-audio-shaped) channel → image it back → get an
advice suggestion whose confidence is the channel's own self-consistency.
Plus the bring-your-own endpoint seam that swaps the deterministic stand-in
for a real QPAM rig without ever faking a result.

Extracted 2026-09-28 from [SuperInstance/pong-quilt](https://github.com/SuperInstance/pong-quilt)
`qa.js` (the L2 advisor) under the "bicycle maker" doctrine: novel tech
embedded in a game, pulled into a standalone module outsiders can adopt and
develop.

## Why you'd want this

Every "ask a model/oracle about state" pipeline hand-rolls three things badly:

1. **A stand-in when the real oracle can't run in your environment.** Here the
   oracle is a QPAM quantum-audio rig (needs qiskit/Aer — not in a browser,
   not in CI). The default channel is a *deterministic, labeled* stand-in:
   3-tap low-pass smoothing + seeded shot noise ∝ 1/√(shotsPerBin), the
   sampling-noise shape the real decode exhibits. Every surface says
   `source: "qa-sim"` and confidence is capped at `SIM_MAX_CONF = 0.5`.
   **A labeled stub beats a fake that pretends.**
2. **An empty-pot seam.** Below `SIM_POT_FLOOR` shots/sample the channel
   returns pure silence and the advisor returns `null` — refusal, not a guess.
   (The `??`-not-`||` semantics matter: a 0 budget is an emptied pot, not a
   request for the default.)
3. **A BYO door.** `suggestByo` POSTs the sonified frame as base64 8-bit shot
   bins (+ pot + seed) to YOUR endpoint, validates the reply (validator is
   injectable), and on ANY failure — no endpoint, fetch error, non-ok, bad
   payload — receipts `byo-qpam-fallback` and degrades to the labeled sim at
   the same seed/pot. A real backend's confidence is **not** sim-capped.

## Use

```js
const { makeHonestyChannel } = require("quantum-audio-honesty");
const qa = makeHonestyChannel();           // reference sonifier: {ballX, paddleX, speed} in [0,1]

qa.suggest({ ballX: 0.3, paddleX: 0.5, speed: 1.2 }, 0x51eed, 32);
// -> { move: -1, confidence: 0.492, source: "qa-sim" }
//    confidence = self-consistency: drift between decoded-image and clean-image positions

await qa.suggestByo(state, seed, pot, { url: "https://my-qpam-rig/roundtrip", fetch });
// -> { kind: "byo-qpam", suggestion: {...}, degraded: false }      (real rig answered)
// -> { kind: "byo-qpam-fallback", reason: "fetch-failure", ... }   (honest degrade)
```

Own state shape? `makeHonestyChannel({ sonify, validateReply, rng, N, deadzone,
envelopeGrid })` — everything is injectable; the honesty contract is not.

Sibling repos (the real quantum pipeline — don't duplicate, integrate):
- `SuperInstance/quilt-quantumaudio-demo` — QPAM encode/decode (9 qubits, depth 2)
- `SuperInstance/quilt-echovision` — sonify → lossy channel → image it back

## Pins

```
node tools/run-tests.js     # 20 pins, FAIL-first (all RED without src/)
```

Five pins are a **faithful-port contract**: expected values were captured live
from pong-quilt `qa.js` @ `b4d15c8`; drift in the extraction trips them.
The rest pin the honesty contract (empty pot, sim cap, labeled degrade,
wire format, determinism, cached envelope measurement).

## Provenance & referral edges

See [docs/PROVENANCE.md](docs/PROVENANCE.md). Named in-repo edges
(per fleet weight law, mintable when a merged PR cites this module):
`quantum-audio-honesty -> pq-l2`, `quantum-audio-honesty -> qad-qpam`,
`quantum-audio-honesty -> qad-echovision`.

## Honest limits

- The default channel is a **stand-in**, sized from a measurement of the real
  QPAM decode (research note in pong-quilt: `research/2026-09-24-quantum-audio-L2.md`),
  not a quantum simulation. Run `suggestByo` against a real rig for real answers.
- The reference sonifier/estimator pair is tuned to tones of 4–12 cycles per
  64-sample frame; other domains should inject their own `sonify`.
- The advisor's `move` semantics ({-1,0,1} with a deadzone) are the reference
  policy's, not a universal recommendation format — inject `validateReply`.
