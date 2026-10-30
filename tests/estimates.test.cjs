const {test}=require('node:test');const assert=require('node:assert/strict');
const {csv,estimateModel,hardwareKey}=require('../dist/estimates.js');
test('CSV quoted commas, quotes and multiline fields survive parsing',()=>{
  assert.deepEqual(csv('name,value\n"a,b","c""d"\n"multiline\nname",3\n'),[{name:'a,b',value:'c"d'},{name:'multiline\nname',value:'3'}]);
});
const games=[{name:'Test',steam_appid:'123',fps_1080p_high_gtx_1650:'40',fps_1080p_high_rtx_3060:'80',page_url:'https://pcgamebenchmarks.com/game/test',engine_fps_cap:'60'}];
const gpus=[{name:'GeForce GTX 1650',g3d_mark:'1000'},{name:'GeForce RTX 3060',g3d_mark:'2000'},{name:'Radeon 740M',g3d_mark:'1500'},{name:'Radeon RX 9999',g3d_mark:'3000'}];
test('exact reference is labeled as a model and respects engine cap',()=>{
  const result=estimateModel(games,gpus,{id:123,name:'Test',gpu:'NVIDIA GeForce RTX 3060'});
  assert.equal(result.available,true);assert.equal(result.fps,60);assert.equal(result.high,60);assert.equal(result.method,'Provider estimate');
});
test('interpolation is bounded by known scores without extrapolation',()=>{
  const result=estimateModel(games,gpus,{id:123,name:'Test',gpu:'AMD Radeon 740M Graphics'});
  assert.equal(result.fps,60);assert.match(result.method,/interpolation/);
  assert.equal(estimateModel(games,gpus,{id:123,name:'Test',gpu:'Radeon RX 9999'}).available,false);
});
test('unrecognized and laptop variants do not silently become desktop models',()=>{
  assert.notEqual(hardwareKey('RTX 3060 Laptop GPU'),hardwareKey('RTX 3060'));
  assert.equal(estimateModel(games,gpus,{id:123,name:'Test',gpu:'RTX 3060 Laptop GPU'}).available,false);
  assert.equal(estimateModel(games,gpus,{id:987,name:'Test',gpu:'RTX 3060'}).available,false);
});
