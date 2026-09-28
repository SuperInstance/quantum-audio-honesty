/* quantum-audio-honesty pins — FAIL-first: every pin here is RED without
 * src/honesty-channel.js. Run: node tools/run-tests.js (exit 1 on any red).
 * Faithful-port pins carry expected values captured LIVE from pong-quilt
 * qa.js @ b4d15c8 (2026-09-28) — the extraction must reproduce the source
 * bit-for-bit, not approximately. */
"use strict";
const { makeHonestyChannel } = require("../src/honesty-channel.js");
const QA = makeHonestyChannel();

let pass = 0, fail = 0;
const fails = [];
function pin(name, cond) {
  if (cond) { pass++; }
  else { fail++; fails.push(name); console.error("RED  " + name); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

(async () => {
  const S = { ballX: 0.3, paddleX: 0.5, speed: 1.2 };

  // --- faithful port: values captured live from pong-quilt qa.js @ b4d15c8 ---
  const clean = QA.sonify(S);
  pin("port: sonify frame head", eq(clean.slice(0, 4).map((x) => +x.toFixed(6)),
    [0, 0.435834, 0.712407, 0.730672]));
  const dec = QA.channel(clean, 0x51eed, 32);
  pin("port: channel frame head", eq(dec.slice(0, 4).map((x) => +x.toFixed(6)),
    [-0.005593, 0.220681, 0.852386, 0.523838]));
  pin("port: suggest end-to-end", eq(QA.suggest(S, 0x51eed, 32),
    { move: -1, confidence: 0.492, source: "qa-sim" }));
  pin("port: estimateX inverts sonify", +QA.estimateX(clean).toFixed(6) === 0.302647);
  pin("port: envelope rows (0/2/32/64)", (() => {
    const env = QA.confidenceEnvelope();
    return eq(env[0], { spb: 0, meanConf: 0, nullFrac: 1 }) &&
           eq(env[2], { spb: 2, meanConf: 0.3358, nullFrac: 0 }) &&
           eq(env[32], { spb: 32, meanConf: 0.4901, nullFrac: 0 }) &&
           eq(env[64], { spb: 64, meanConf: 0.4935, nullFrac: 0 });
  })());

  // --- honesty contract ---
  pin("empty pot: spb 0 -> silence", eq(QA.channel(clean, 0x51eed, 0), new Array(64).fill(0)));
  pin("empty pot: 0 is not default", QA.channel(clean, 0x51eed, 0).every((v) => v === 0) &&
    !QA.channel(clean, 0x51eed, undefined).every((v) => v === 0)); // `??` not `||`
  pin("empty pot: no advice (null, never a fake)", QA.suggest(S, 0x51eed, 0) === null);
  pin("sim confidence capped + labeled", (() => {
    const r = QA.suggest(S, 0x51eed, 64);
    return r.confidence <= QA.SIM_MAX_CONF && r.source === "qa-sim";
  })());
  pin("noise scales ~1/sqrt(shots): sd(8) > sd(64)", (() => {
    const sd = (a) => { const m = a.reduce((x, y) => x + y) / a.length;
      return Math.sqrt(a.reduce((x, y) => x + (y - m) * (y - m), 0) / a.length); };
    return sd(QA.channel(clean, 1234, 8)) > sd(QA.channel(clean, 1234, 64));
  })());
  pin("channel deterministic at fixed seed",
    eq(QA.channel(clean, 42, 16), QA.channel(clean, 42, 16)) &&
    !eq(QA.channel(clean, 42, 16), QA.channel(clean, 43, 16)));
  pin("envelope cached (measurement, not re-roll)",
    QA.confidenceEnvelope() === QA.confidenceEnvelope());

  // --- wire format ---
  pin("shotBins 8-bit quantize", eq(QA.shotBins([-1, -0.5, 0, 0.5, 1]), [0, 64, 128, 191, 255]));
  pin("toB64 zero-dep correct", QA.toB64([97, 98, 99]) === "YWJj" &&
    QA.toB64(QA.shotBins([-1, -0.5, 0, 0.5, 1])) === "AECAv/8=");

  // --- BYO seam: ships closed, degrades honestly, never fakes ---
  const closed = await QA.suggestByo(S, 0x51eed, 32, {});
  pin("byo: ships closed", closed.kind === "byo-qpam-fallback" && closed.reason === "no-endpoint" &&
    closed.degraded === true && closed.suggestion.source === "qa-sim");
  const boom = await QA.suggestByo(S, 0x51eed, 32, { url: "http://x", fetch: () => Promise.reject(new Error("down")) });
  pin("byo: fetch-failure degrades", boom.kind === "byo-qpam-fallback" && boom.reason === "fetch-failure");
  const bad = await QA.suggestByo(S, 0x51eed, 32, { url: "http://x",
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ move: 7, confidence: 2 }) }) });
  pin("byo: invalid reply NEVER passes", bad.kind === "byo-qpam-fallback" && bad.reason === "jev-invalid");
  const real = await QA.suggestByo(S, 0x51eed, 32, { url: "http://rig", fetch: (u, init) => {
    const wire = JSON.parse(init.body);
    pin("byo: wire carries bins+pot+seed", typeof wire.binsB64 === "string" && wire.shotsPerBin === 32 && wire.seed === 0x51eed);
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ move: 1, confidence: 0.95, source: "my-qpam-rig" }) });
  } });
  pin("byo: real reply NOT sim-capped", real.kind === "byo-qpam" && real.degraded === false &&
    real.suggestion.confidence === 0.95 && real.suggestion.source === "my-qpam-rig");
  const custom = makeHonestyChannel({ validateReply: (j) => typeof j.verdict === "string" });
  const customs = await custom.suggestByo(S, 1, 32, { url: "http://x",
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ verdict: "LEFT", confidence: 0.5 }) }) });
  pin("byo: validator injectable", customs.kind === "byo-qpam" && customs.degraded === false); // custom validator honored, default shape irrelevant

  console.log(`pins: ${pass} green, ${fail} red`);
  if (fail) { console.error("FAILED: " + fails.join(" | ")); process.exit(1); }
})();
