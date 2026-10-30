let publicRows = null, publicRequest = null;
let currentEstimate = null, deviceRows = [], estimateVersion = 0;
function sourceButton(url,label) {
  const button=document.createElement('button');button.className='text-button';button.textContent=label+' ↗';
  button.onclick=()=>api.openDataSource(url).catch(e=>status(e.message,true));return button;
}
function renderFps() {
  const target=$('fps-result'); if(!target)return;
  if(!currentEstimate) {target.innerHTML='<div class="fps-empty"><strong>— <small>FPS</small></strong></div>';return;}
  const supported=$('resolution').value==='1920×1080'&&$('preset').value==='High';
  if(!currentEstimate.available||!supported) {
    target.innerHTML=`<p class="muted">${escapeHtml(supported ? currentEstimate.reason : 'PC model supports 1080p High. Other settings may have reference results below.')}</p>`;return;
  }
  target.innerHTML=`<div class="estimate-value">${currentEstimate.low}–${currentEstimate.high} <small>FPS</small></div><p class="muted">Low confidence · GPU-based estimate · ${escapeHtml(currentEstimate.gpu)}</p><details><summary>Estimate details</summary><p>${escapeHtml(currentEstimate.method)}. ${escapeHtml(currentEstimate.notes)}</p><p>${escapeHtml(currentEstimate.conditions)}</p></details>`;
  const requiredRam=gb(game.minimum,'Memory');
  if(profile&&requiredRam!==null&&profile.ramGb<requiredRam){const warning=document.createElement('p');warning.className='bad';warning.textContent='RAM is below minimum; this GPU estimate may be unattainable.';target.append(warning);}
  target.append(sourceButton(currentEstimate.source,'PCGameBenchmarks · CC BY 4.0'));
  animatePanel(target);
}
function renderDevices() {
  const area=$('device-results');if(!area)return;area.replaceChildren();
  if(!deviceRows.length){area.innerHTML='<p class="muted">No device references for this game.</p>';return;}
  const details=document.createElement('details');details.innerHTML='<summary>SteamFPS device references</summary>';
  for(const row of deviceRows){const p=document.createElement('p');p.className='muted';p.textContent=`${row.device}: ${row.fps} FPS · ${row.resolution} · ${row.preset} · ${row.mode} · ${row.basis} (different hardware / SteamOS)`;details.append(p);}
  details.append(sourceButton(deviceRows[0].source,'SteamFPS · CC BY 4.0'));area.append(details);
}
function setupEstimates() {
  currentEstimate=null;deviceRows=[];
  const summary=document.createElement('div');summary.className='overview-fps';summary.id='overview-fps';summary.innerHTML='<span class="muted">FRAME RATE</span><strong>—</strong><button id="view-estimate">View estimate ↗</button>';
  $('panel-overview').append(summary);$('view-estimate').onclick=()=>$('tab-benchmarks').click();
  const refresh=document.createElement('button');refresh.id='estimate-refresh';refresh.textContent='Refresh sources ↻';refresh.onclick=load;
  document.querySelector('.fps>.section-heading').append(refresh);
  const device=document.createElement('div');device.id='device-results';document.querySelector('.fps').append(device);
  $('benchmark-gpu').onchange=load;
  async function load() {
    const request=++estimateVersion;const selected=game;const gpu=$('benchmark-gpu').value;
    currentEstimate=null;renderFps();refresh.disabled=true;refresh.textContent='Checking sources…';
    const modelTask=gpu ? api.estimate({id:selected.id,name:selected.name,gpu}) : Promise.resolve({available:false,reason:'Scan hardware or enter a profile first.'});
    const deviceTask=api.deviceResults({id:selected.id,name:selected.name});
    await Promise.allSettled([
      modelTask.then(data=>{if(request!==estimateVersion)return;currentEstimate=data;renderFps();const value=$('overview-fps')?.querySelector('strong');if(value)value.textContent=data.available ? `${data.low}–${data.high} FPS · 1080p High` : 'Unavailable';}).catch(()=>{if(request!==estimateVersion)return;currentEstimate={available:false,reason:'PC estimate source unavailable. Retry later.'};renderFps();}),
      deviceTask.then(rows=>{if(request!==estimateVersion)return;deviceRows=rows;renderDevices();}).catch(()=>{if(request===estimateVersion&&$('device-results'))$('device-results').innerHTML='<p class="muted">SteamFPS is temporarily unavailable.</p>';}),
      loadPublicRows().then(()=>{if(request===estimateVersion)renderPublicBenchmarks();}).catch(()=>{if(request===estimateVersion&&$('public-results'))$('public-results').innerHTML='<p class="muted">Measured reference source unavailable.</p>';})
    ]);
    if(request===estimateVersion){refresh.disabled=false;refresh.textContent='Refresh sources ↻';}
  }
  load();
}
async function loadPublicRows() {
  publicRequest ??= api.publicBenchmarks().finally(()=>{publicRequest=null;});
  publicRows=await publicRequest;
}
const modelKey = value => String(value).toLowerCase().replace(/\(r\)|\(tm\)/g,'').replace(/\b(amd|nvidia|intel|geforce|radeon|processor|cpu)\b/g,'').replace(/\s+\d+-core.*$/,'').replace(/[^a-z0-9]/g,'');
const gpuModel = value => String(value).toLowerCase().match(/(?:rtx|gtx)\s*\d{3,4}(?:\s*(?:ti|super))?(?:\s*(?:laptop|mobile))?|rx\s*\d{3,4}\s*(?:xtx|xt|m)?|radeon\s*\d{3}m/)?.[0].replace(/\s/g,'') ?? modelKey(value);
function renderPublicBenchmarks() {
  const container = $('public-results');
  if (!container) return;
  if (!publicRows) { container.innerHTML = '<p class="muted">Load public results to compare tested systems.</p>'; return; }
  const gpu = $('benchmark-gpu').value;
  const all = $('reference-scope').value === 'all';
  const rows = publicRows.filter(row => (row.gameId === game.id || (game.manual && norm(row.game) === norm(game.name))) && row.resolution === $('resolution').value && (all || (gpu && gpuModel(gpu) === gpuModel(row.gpu))));
  if (!rows.length) { container.innerHTML = '<p class="muted">0 reference results for this selection.</p>'; return; }
  container.innerHTML = rows.map(row => {
    const cpuMatch = profile && modelKey(profile.cpu) === modelKey(row.cpu);
    const gpuMatch = gpu && gpuModel(gpu) === gpuModel(row.gpu);
    const ramMatch = profile && profile.ramGb === row.ram;
    const presetMatch = row.preset === $('preset').value;
    return `<article class="public-result"><div class="section-heading"><strong>${row.fps} <small>AVG FPS</small></strong><span>${row.low ?? '—'} <small>1% LOW</small></span></div><p>${escapeHtml(row.mode)} · ${escapeHtml(row.preset)} · ${escapeHtml(row.resolution)}</p><p class="muted">${escapeHtml(row.gpu)} / ${escapeHtml(row.cpu)} / ${row.ram} GB</p><p class="muted">${gpuMatch ? 'Same GPU family; board and tuning may differ' : 'Different GPU'} · ${cpuMatch ? 'CPU model matches' : 'Different CPU'} · ${ramMatch ? 'RAM capacity matches' : 'Different RAM capacity'} · ${presetMatch ? 'Preset matches' : 'Different preset'}</p><p class="muted">Reference measurement · ${escapeHtml(row.date)} · GPU tuning and game patch not specified per run.</p></article>`;
  }).join('') + '<button id="benchmark-source" class="text-button">TechFuelHQ / Lowell K. Wood IV · CC BY 4.0 ↗</button>';
  $('benchmark-source').onclick = () => api.openBenchmarkSource().catch(e=>status(e.message,true));
}
function setupPublicBenchmarks() {
  const area = document.createElement('div'); area.className = 'public-benchmarks';
  area.innerHTML = `<div class="section-heading"><h3>Public results</h3><button id="load-public">Load results ↻</button></div><div class="actions"><select id="benchmark-gpu" aria-label="GPU for public benchmarks">${(profile?.gpu ?? []).map(gpu=>`<option>${escapeHtml(gpu)}</option>`).join('')}</select><select id="reference-scope" aria-label="Reference hardware"><option value="same">Same GPU family</option><option value="all">All reference systems</option></select></div><div id="public-results"></div><div class="research"><button id="youtube-benchmarks">Find video benchmarks ↗</button><button id="web-benchmarks">Find benchmark reports ↗</button></div>`;
  document.querySelector('.fps').append(area);
  $('benchmark-gpu').onchange = renderPublicBenchmarks;
  $('reference-scope').onchange = renderPublicBenchmarks;
  $('load-public').onclick = async () => {
    const button = $('load-public'); button.disabled = true; button.textContent = 'Loading…';
    try {
      await loadPublicRows(); renderPublicBenchmarks();
    } catch(e) { if ($('public-results')) $('public-results').textContent = 'Could not load public results. Try again later.'; }
    finally { if (button.isConnected) { button.disabled=false;button.textContent='Load results ↻'; } }
  };
  const research = provider => {
    const query = [game.name,profile?.cpu,$('benchmark-gpu').value,$('resolution').value,$('preset').value,'FPS benchmark'].filter(Boolean).join(' ').slice(0,500);
    api.openResearch({provider,query}).catch(e=>status(e.message,true));
  };
  $('youtube-benchmarks').onclick = () => research('youtube');
  $('web-benchmarks').onclick = () => research('google');
  renderPublicBenchmarks();
}
