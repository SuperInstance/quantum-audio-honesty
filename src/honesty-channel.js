/* quantum-audio-honesty — the waveform-imaging honesty channel, standalone.
 *
 * Extracted 2026-09-28 from SuperInstance/pong-quilt qa.js (L2 advisor) under
 * the "bicycle maker" doctrine: pong-quilt's embedded novel tech, pulled into
 * a zero-dependency module outsiders can adopt and develop. Sibling ports of
 * the REAL quantum pipeline exist in the same org — SuperInstance/quilt-quantumaudio-demo
 * (QPAM encode/decode, 9 qubits depth 2) and SuperInstance/quilt-echovision
 * (sonify -> lossy channel -> image it back). This module is the honest
 * STAND-IN channel + the BYO-endpoint door; it does not duplicate the QPAM rig.
 *
 * HONESTY CONTRACT (fleet doctrine — a labeled stub beats a fake that pretends):
 * The default channel is a DETERMINISTIC STAND-IN for the QPAM lossy round-trip
 * (3-tap low-pass smoothing + seeded shot noise ~ 1/sqrt(shotsPerBin), the
 * sampling-noise shape the real decode exhibits). Every surface says so:
 * source tag "qa-sim", UI labels, receipts. The suggestByo seam is the
 * bring-your-own door: POST the sonified frame as base64 shot bins to YOUR
 * real QPAM endpoint, take a validated suggestion back; ANY failure receipts
 * byo-qpam-fallback and degrades to the labeled sim at the same seed/pot.
 * The stand-in's confidence is capped at SIM_MAX_CONF — a stand-in never
 * claims full trust; a real backend's confidence is NOT sim-capped.
 *
 * UMD: node (module.exports) and browser (root.QuantumAudioHonesty) both fine.
 * Zero dependencies. Keep in sync: no build step, this file IS the artifact. */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.QuantumAudioHonesty = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Default rng: the same LCG family as pong-quilt core.js, so the stand-in
  // reproduces pong-quilt's seeded numbers bit-for-bit (faithful-port pins
  // check this). Inject your own via factory({rng}) for domain-specific streams.
  function defaultRng(seed) {
    let s = seed >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }

  function makeHonestyChannel(opts) {
    opts = opts || {};
    const rng = opts.rng || defaultRng;

    const N = opts.N || 64;               // samples per state-imaging frame
    const SIM_MAX_CONF = 0.5;             // stand-in confidence cap (honesty contract)
    const DEAD_ZCR = 0.02;                // below this the channel returned silence -> no advice
    const SIM_POT_FLOOR = 2;              // shots/sample floor: below this the pot is EMPTY — no image at all

    // --- 1. sonify: state -> waveform (echovision idiom: emit, hear it back).
    // Reference sonifier in pong-quilt state units (ballX, paddleX in [0,1]).
    // Outsiders with their own state shape: pass opts.sonify to the factory.
    const sonify = opts.sonify || function (s) {
      const f = 4 + 8 * Math.max(0, Math.min(1, s.ballX));     // position -> tone (4..12 cycles/frame)
      const amp = 0.5 + 0.5 * Math.min(1, (s.speed || 1) / 3); // speed -> envelope
      const intercept = (s.paddleX + 0.08) - s.ballX;          // positive: paddle right of ball
      const w = new Array(N);
      for (let i = 0; i < N; i++) {
        const t = i / N;
        w[i] = amp * Math.sin(2 * Math.PI * f * t) + 0.30 * intercept * Math.sin(2 * Math.PI * 3 * t);
      }
      return w;
    };

    // --- 2. channel: DETERMINISTIC STAND-IN for the QPAM encode/decode round-trip.
    // 3-tap low-pass (the smoothing QPAM decode exhibits) + seeded shot noise,
    // amplitude ~ 1/sqrt(shotsPerBin) like real sampling noise.
    function channel(w, seed, shotsPerBin) {
      // `??` not `||` — a 0 budget is the EMPTY POT, not a request for the
      // default. `|| 32` silently re-arms an emptied pot (pong-quilt Round 13).
      const spb = shotsPerBin ?? 32;
      if (spb < SIM_POT_FLOOR) return new Array(w.length).fill(0); // empty pot: no measurement returns
      const rand = rng((seed == null ? 0x51eed : seed) >>> 0);
      const noiseAmp = 1.6 / Math.sqrt(spb);
      const lp = new Array(w.length);
      for (let i = 0; i < w.length; i++) {
        const a = i > 0 ? w[i - 1] : w[i], b = i < w.length - 1 ? w[i + 1] : w[i];
        lp[i] = (a + 2 * w[i] + b) / 4;
      }
      return lp.map((v) => v + (rand() - 0.5) * 2 * noiseAmp);
    }

    // --- 3. image it back: recover the tone period from the decoded waveform.
    // Autocorrelation peak over periods 5..16 samples (f in 4..12 cycles per 64)
    // — robust to the intercept harmonic; zero-crossing count alone was not.
    // Parabolic interpolation around the peak recovers sub-sample lag; without
    // it integer quantization biased the estimate by up to 1/16 field (caught
    // by pong-quilt's tests at birth).
    function estimateX(d) {
      const cs = [];
      for (let lag = 5; lag <= 16; lag++) {
        let c = 0;
        for (let i = 0; i + lag < d.length; i++) c += d[i] * d[i + lag];
        cs.push(c);
      }
      let bi = 0;
      for (let k = 1; k < cs.length; k++) if (cs[k] > cs[bi]) bi = k;
      const lag = 5 + bi;
      let offset = 0;
      if (bi > 0 && bi < cs.length - 1) {
        const a = cs[bi - 1], b = cs[bi], c = cs[bi + 1], den = a - 2 * b + c;
        if (Math.abs(den) > 1e-12) offset = Math.max(-0.5, Math.min(0.5, 0.5 * (a - c) / den));
      }
      const fHat = N / (lag + offset);
      return Math.max(0, Math.min(1, (fHat - 4) / 8));     // invert sonify(): tone -> position [0,1]
    }
    function zeroCrossingRate(d) {
      let zc = 0;
      for (let i = 1; i < d.length; i++) if ((d[i - 1] < 0) !== (d[i] < 0)) zc++;
      return zc / d.length;
    }

    // --- 4. the advisor: state -> suggestion {move, confidence, source}.
    // Confidence = self-consistency of the imaging: drift between the position
    // imaged from the decoded waveform and the position imaged from the clean
    // one. A lossier channel -> more drift -> honestly lower confidence.
    // Sim cap last; null (not a fake) when the pot is empty.
    function suggest(s, seed, shotsPerBin) {
      const clean = sonify(s);
      const decoded = channel(clean, seed, shotsPerBin);
      if (zeroCrossingRate(decoded) < DEAD_ZCR) return null; // pot-bound: no echo, no advice
      const xClean = estimateX(clean), xHat = estimateX(decoded);
      const drift = Math.abs(xHat - xClean);
      const agree = Math.max(0, 1 - drift / 0.25);      // full agreement within a quarter-field
      const dead = opts.deadzone === undefined ? 0.06 : opts.deadzone;
      const px = s.paddleX + 0.08;
      const move = xHat < px - dead ? -1 : xHat > px + dead ? 1 : 0;
      return { move, confidence: +(Math.min(SIM_MAX_CONF, 0.5 * agree).toFixed(3)), source: "qa-sim" };
    }

    // --- 5. confidence-vs-pot envelope: the measurement shape, computed ONCE
    // over a fixed state grid (seeded, deterministic) and cached — a
    // measurement, not a live re-roll. Each row {spb, meanConf, nullFrac};
    // meanConf is the mean over ADVISED states only (below the floor every
    // state refuses — nullFrac says that; meanConf stays 0 rather than
    // laundering refusals into data). Grid is opts.envelopeGrid or the
    // 9x9 reference grid pong-quilt pinned.
    let _envelope = null;
    function confidenceEnvelope() {
      if (_envelope) return _envelope;
      const grid = opts.envelopeGrid || (() => {
        const g = [];
        for (let bx = 1; bx <= 9; bx++)
          for (let px = 1; px <= 9; px++)
            g.push({ ballX: bx / 10, paddleX: px / 10, speed: 1.2 });
        return g;
      })();
      const rows = [];
      for (let spb = 0; spb <= 64; spb++) {
        let advised = 0, confSum = 0;
        for (let i = 0; i < grid.length; i++) {
          const r = suggest(grid[i], (0x51eed + i * 2654435761) >>> 0, spb);
          if (r) { advised++; confSum += r.confidence; }
        }
        rows.push({ spb, meanConf: advised ? +(confSum / advised).toFixed(4) : 0, nullFrac: +(1 - advised / grid.length).toFixed(4) });
      }
      _envelope = rows;
      return _envelope;
    }

    // --- 6. BYO real-backend endpoint seam. Hand the state to YOUR endpoint
    // (a real QPAM rig — see sibling repos) and take its suggestion back.
    // Honesty contract:
    //   - wire = the sonified frame as 8-bit shot bins (base64) + shotsPerBin +
    //     seed; the backend performs its own encode/measure/decode on those bins.
    //   - the response is validated by opts.validateReply (default: move in
    //     {-1,0,1}, confidence in [0,1]) — an invalid payload NEVER reaches the
    //     consumer.
    //   - ANY failure (no endpoint, fetch error, non-ok status, bad payload)
    //     returns kind "byo-qpam-fallback" with the labeled sim at the SAME
    //     seed/pot. Never silent, never a fake that pretends.
    //   - a real backend's confidence is NOT sim-capped.
    const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    function toB64(bytes) { // zero-dep base64 (neither btoa nor Buffer)
      let out = "";
      for (let i = 0; i < bytes.length; i += 3) {
        const a = bytes[i];
        const b = i + 1 < bytes.length ? bytes[i + 1] : null;
        const c = i + 2 < bytes.length ? bytes[i + 2] : null;
        out += B64[a >> 2] + B64[((a & 3) << 4) | (b === null ? 0 : b >> 4)] +
               (b === null ? "=" : B64[((b & 15) << 2) | (c === null ? 0 : c >> 6)]) +
               (c === null ? "=" : B64[c & 63]);
      }
      return out;
    }
    function shotBins(w) { // waveform -> 8-bit bins (the bytes the backend images)
      const bins = new Array(w.length);
      for (let i = 0; i < w.length; i++) bins[i] = Math.max(0, Math.min(255, Math.round((w[i] + 1) * 127.5)));
      return bins;
    }
    const defaultValidate = (j) =>
      !!j && typeof j === "object" &&
      (j.move === -1 || j.move === 0 || j.move === 1) &&
      typeof j.confidence === "number" && j.confidence >= 0 && j.confidence <= 1 &&
      Number.isFinite(j.confidence);
    const validateReply = opts.validateReply || defaultValidate;

    async function suggestByo(s, seed, shotsPerBin, callOpts) {
      callOpts = callOpts || {};
      const url = callOpts.url;
      const fetchImpl = callOpts.fetch || (typeof fetch !== "undefined" ? fetch : null);
      const refuse = (reason) => ({ // the honest degrade: labeled sim, same seed/pot, reason named
        suggestion: suggest(s, seed, shotsPerBin),
        kind: "byo-qpam-fallback", reason, degraded: true,
      });
      if (!url || !fetchImpl) return refuse("no-endpoint"); // seam ships closed by default
      let res;
      try {
        res = await fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            binsB64: toB64(shotBins(sonify(s))),
            shotsPerBin: shotsPerBin === undefined ? null : shotsPerBin,
            seed: seed === undefined ? null : seed,
          }),
        });
      } catch (e) {
        return refuse("fetch-failure");
      }
      if (!res || !res.ok) return refuse("fetch-failure");
      let j = null;
      try { j = await res.json(); } catch (e) { return refuse("jev-invalid"); }
      if (!validateReply(j)) return refuse("jev-invalid");
      return {
        suggestion: { move: j.move, confidence: j.confidence,
                      source: typeof j.source === "string" && j.source ? j.source : "byo-qpam" },
        kind: "byo-qpam", reason: null, degraded: false,
      };
    }

    return { N, SIM_MAX_CONF, DEAD_ZCR, SIM_POT_FLOOR, sonify, channel, estimateX,
             zeroCrossingRate, suggest, suggestByo, confidenceEnvelope, shotBins, toB64 };
  }

  return { makeHonestyChannel, defaultRng };
});
