const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parsePublicBenchmarks } = require('../dist/benchmarks.js');
const fixture = points => ({ dataset_id:'rog-astral-rtx-5080-oc-2026-06-09', license:{spdx_id:'CC-BY-4.0'},system_under_test:{cpu:'AMD Ryzen 7 7800X3D',gpu:'ASUS ROG Astral RTX 5080 OC',test_date_window:'2026-06-08 to 2026-06-11'},charts:[{chart_id:'06-4k-gaming',data_points:points}] });
test('public benchmarks retain measurement modes and provenance',()=>{
  const rows=parsePublicBenchmarks(fixture([{label:'Cyberpunk Ultra (raster)',avg_fps:58,low_1pct_fps:49},{label:'Cyberpunk Path Tracing (native)',avg_fps:19,low_1pct_fps:15}]));
  assert.equal(rows.length,2);assert.equal(rows[0].gameId,1091500);assert.equal(rows[0].low,49);assert.equal(rows[1].preset,'Overdrive');assert.equal(rows[0].license,'CC BY 4.0');
});
test('unknown rows and invalid measurements are excluded',()=>{
  assert.deepEqual(parsePublicBenchmarks(fixture([{label:'Unknown title',avg_fps:80},{label:'Cyberpunk Ultra (raster)',avg_fps:-1}])),[]);
  assert.throws(()=>parsePublicBenchmarks({}),/format changed/);
});
test('Alan Wake 2 is never assigned the original Alan Wake app ID',()=>{
  const rows=parsePublicBenchmarks(fixture([{label:'Alan Wake 2 RT + DLSS-Q',avg_fps:49}]));
  assert.equal(rows[0].gameId,null);assert.equal(rows[0].game,'Alan Wake 2');
});
