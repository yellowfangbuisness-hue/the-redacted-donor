// Saves can come from another device or a transfer code, so readRun must make any of them safe to load.
//   node tools/save.test.mjs
import assert from 'node:assert/strict';
import { fresh, readRun, record, canBuy, buy } from '../src/campaign.js';
const load = (o) => readRun(JSON.stringify(o));
const good = load({ ...fresh(), stage: 'detective', caseIndex: 1, exhibits: [0, 1, 8], links: [0], checkpoint: { exhibits: [0, 1, 8], links: [0] }, position: [1, 2, .3, 0], gates: [true, false] });
assert.deepEqual(good.exhibits, [0, 1, 8]); assert.deepEqual(good.links, [0]); assert.deepEqual(good.gates, [true, false]); assert.deepEqual(good.position, [1, 2, .3, 0]);
// A hostile save: ids that do not exist, wrong shapes, and fields the game would crash on.
const bad = load({ version: 2, stage: 'gate', caseIndex: 0, gateStep: 'x', gates: null, found: ['nope'], awards: [7, 'curio:safe'], exhibits: [99, 0, 0, 'a'], links: [99, -1, 0], codes: ['ledger', 'zzz', 5], checkpoint: { exhibits: [42], links: [] }, stats: null, loss: 'x', position: ['a'] });
assert.deepEqual(bad.exhibits, [0]); assert.deepEqual(bad.links, [0]); assert.deepEqual(bad.checkpoint, { exhibits: [], links: [] });
assert.deepEqual(bad.gates, [false, false]); assert.equal(bad.gateStep, ''); assert.deepEqual(bad.awards, ['curio:safe']); assert.deepEqual(bad.codes, ['ledger']); assert.deepEqual(bad.found, []);
assert.equal(bad.stats.seconds, 0); assert.deepEqual(bad.stats.items, []); assert.equal(bad.loss, null); assert.equal(bad.position, undefined);
for (const junk of ['', 'null', '{}', '[]', '{"version":2,"stage":"nowhere"}', '{"version":2,"stage":"end","caseIndex":9}']) assert.equal(readRun(junk), null);
// A lead whose puzzle was opened by day still counts if night falls before it is finished; without `late` it does not.
const mem = { ...fresh(), stage: 'memory', hasWatch: true, solarTime: 60 };   // night
assert.equal(record(mem, 'dispatch'), null); assert.ok(record(mem, 'dispatch', true)); assert.deepEqual(mem.found, ['dispatch']);
// The two tools the story needs can be bought on credit; nothing else can.
const broke = { ...fresh(), hasWatch: true, score: 10 };
assert.equal(canBuy(broke, 'luminol'), true); assert.equal(canBuy(broke, 'soles'), false); assert.equal(buy(broke, 'luminol'), true); assert.equal(broke.score, -140); assert.equal(canBuy(broke, 'luminol'), false);
console.log('All save tests passed');
