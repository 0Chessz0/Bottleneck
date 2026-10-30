const api = window.bottleneck;
const $ = id => document.getElementById(id);
let profile = null, game = null;
let activePanel = 'overview';
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
function status(text, error = false) { $('status').textContent = text; $('status').className = error ? 'error' : ''; }
function showHardware() {
  $('profile-tag').textContent = profile.manual ? 'MANUAL PROFILE' : 'DETECTED';
  $('hardware').innerHTML = [['PROCESSOR',profile.cpu],['GRAPHICS',profile.gpu.join(' / ')],['MEMORY',`${profile.ramGb} GB`],['OPERATING SYSTEM',profile.os],['AVAILABLE STORAGE',profile.drives.map(d => `${d.name} ${d.freeGb} GB`).join(' / ')]].map(([label,value]) => `<div><label>${label}</label><strong>${escapeHtml(value)}</strong></div>`).join('');
  if (game) renderGame();
}
async function scan() {
  $('scan').disabled = true; $('scan').textContent = 'Scanning…';
  try { profile = await api.scan(); showHardware(); status('Hardware scan complete. Select the drive you plan to install on below.'); }
  catch (e) { status(e.message, true); }
  finally { $('scan').disabled = false; $('scan').textContent = 'Scan hardware ↻'; }
}
$('scan').onclick = scan;
function editor(title, fields, submit) {
  $('edit-title').textContent = title;
  $('fields').replaceChildren();
  for (const field of fields) {
    const label = document.createElement('label'); label.textContent = field.label;
    const input = document.createElement(field.area ? 'textarea' : 'input');
    input.name = field.name; input.value = field.value ?? ''; input.required = field.required !== false;
    if (!field.area) { input.type = field.type ?? 'text'; if (field.type === 'number') { input.min = field.min ?? '0.1'; input.step = 'any'; } }
    label.append(input); $('fields').append(label);
  }
  $('edit-form').onsubmit = async event => {
    event.preventDefault();
    try { await submit(Object.fromEntries(new FormData(event.target))); $('editor').close(); }
    catch (e) { status(e.message, true); }
  };
  $('editor').showModal();
}
$('close').onclick = () => $('editor').close();
$('manual').onclick = () => editor('Hardware profile', [
  {name:'cpu',label:'Processor',value:profile?.cpu}, {name:'gpu',label:'Graphics card (one active GPU)',value:profile?.gpu[0]},
  {name:'ram',label:'Installed RAM (GB)',type:'number',value:profile?.ramGb}, {name:'os',label:'Operating system',value:profile?.os ?? 'Windows 11'},
  {name:'disk',label:'Install drive',value:profile?.drives[0]?.name ?? 'C:'}, {name:'free',label:'Free space (GB)',type:'number',min:'0',value:profile?.drives[0]?.freeGb}
], data => { profile = {cpu:data.cpu.trim(),gpu:[data.gpu.trim()],ramGb:Number(data.ram),os:data.os,drives:[{name:data.disk,freeGb:Number(data.free)}],manual:true}; showHardware(); });
function resultButtons(items, select) {
  $('results').replaceChildren();
  for (const item of items) {
    const button = document.createElement('button'); button.className = 'result';
    const name = document.createElement('b'); name.textContent = item.name;
    const arrow = document.createElement('span'); arrow.textContent = '↗'; button.append(name,arrow);
    button.onclick = () => { for(const sibling of $('results').children) sibling.classList.remove('selected'); button.classList.add('selected'); select(item); }; $('results').append(button);
  }
}
let searchVersion = 0;
$('search-form').onsubmit = async event => {
  event.preventDefault(); const version = ++searchVersion; const query = $('query').value.trim(); if (!query) return;
  status('Searching Steam…');
  try {
    const id = query.match(/^(?:https:\/\/store\.steampowered\.com\/app\/)?(\d+)(?:\/.*)?$/)?.[1];
    if (id) { await selectGame(Number(id)); return; }
    const results = await api.search(query); if (version !== searchVersion) return;
    resultButtons(results, item => selectGame(item.id));
    status(results.length ? `${results.length} results. Steam search returns a limited selection; use an app link for an exact lookup.` : 'No results. Try a Steam link or add a game manually.');
  } catch (e) { if (version === searchVersion) status(e.message,true); }
};
let selectionVersion = 0;
async function selectGame(id) {
  const version = ++selectionVersion; status('Loading requirements…');
  try { const selected = await api.game(id); if (version !== selectionVersion) return; game = selected; activePanel='overview'; renderGame(); status('Requirements loaded from Steam.'); }
  catch (e) { if (version === selectionVersion) status(e.message,true); }
}
$('custom').onclick = () => editor('Add a game', [{name:'name',label:'Game title'},{name:'source',label:'Requirements source URL',type:'url'},{name:'minimum',label:'Minimum requirements. Use separate lines: Processor:, Graphics:, Memory: 16 GB, Storage: 80 GB',area:true},{name:'recommended',label:'Recommended requirements',area:true,required:false}], async data => { game = {...data,id:'manual-'+crypto.randomUUID(),windows:true,manual:true}; renderGame(); status('Manual requirements. Check these against the publisher’s current specifications.'); });
function gb(text,label) {
  const line = text.split('\n').find(x => x.toLowerCase().startsWith(label.toLowerCase()+':'));
  const match = line?.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  return match ? Number(match[1]) * ({GB:1,MB:1/1024,TB:1024}[match[2].toUpperCase()]) : null;
}
function stat(label,title,note,kind='') { return `<div class="stat"><label>${label}</label><strong class="${kind}">${escapeHtml(title)}</strong><p>${escapeHtml(note)}</p></div>`; }
function renderGame() {
  $('empty-state').hidden = true;
  $('detail').hidden = false;
  const memory = gb(game.minimum,'Memory'), storage = gb(game.minimum,'Storage');
  let checks = stat('HARDWARE','Scan required','Scan your PC or enter a profile.');
  if (profile) {
    checks = stat('MEMORY',memory === null ? 'Unknown' : profile.ramGb >= memory ? 'Enough RAM' : 'Below minimum',memory === null ? 'No readable memory requirement.' : `${profile.ramGb} GB installed / ${memory} GB minimum`,memory === null ? '' : profile.ramGb >= memory ? 'good' : 'bad');
    checks += stat('PROCESSOR / GRAPHICS','Needs verification','Compare required models or check Benchmarks.');
    checks += stat('PLATFORM',game.windows ? 'Windows listed' : 'Windows not listed','Check OS version, DirectX and VRAM.');
  }
  $('detail').innerHTML = `<div class="section-heading"><h2>${escapeHtml(game.name)}</h2></div><div class="checks">${checks}</div><div class="section-heading drive"><p class="muted">INSTALL DRIVE</p><select id="drive" aria-label="Install drive">${(profile?.drives ?? []).map((d,i)=>`<option value="${i}">${escapeHtml(d.name)} · ${d.freeGb} GB free</option>`).join('')}</select><span id="storage"></span></div><div class="requirements"><div><h2>Minimum</h2><pre>${escapeHtml(game.minimum || 'No requirements published.')}</pre></div><div><h2>Recommended</h2><pre>${escapeHtml(game.recommended || 'No recommended requirements published.')}</pre></div></div><p class="source">Source: ${escapeHtml(game.source)}${game.manual ? ' · manually entered' : ' · retrieved '+new Date(game.retrievedAt).toLocaleDateString()}</p><div class="fps"><div class="section-heading"><h3>Frame rate outlook</h3></div><div class="actions"><select id="resolution" aria-label="Resolution"><option>1920×1080</option><option>2560×1440</option><option>3840×2160</option></select><select id="preset" aria-label="Preset"><option>Low</option><option>Medium</option><option selected>High</option><option>Ultra</option></select></div><div id="fps-result"></div></div>`;
  const tabs = document.createElement('div'); tabs.className = 'detail-tabs'; tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','Game details');
  const body = document.createElement('div'); body.className = 'panel-body';
  const overview = document.createElement('div'); overview.id = 'panel-overview';
  overview.append($('detail').querySelector('.checks'),$('detail').querySelector('.drive'));
  const requirements = document.createElement('div'); requirements.id = 'panel-requirements';
  requirements.append($('detail').querySelector('.requirements'),$('detail').querySelector('.source'));
  const benchmarks = document.createElement('div'); benchmarks.id = 'panel-benchmarks'; benchmarks.append($('detail').querySelector('.fps'));
  for (const [id,label] of [['overview','Overview'],['requirements','Requirements'],['benchmarks','Benchmarks']]) {
    const button = document.createElement('button'); button.id = 'tab-'+id; button.textContent = label; button.setAttribute('role','tab'); button.setAttribute('aria-controls','panel-'+id);
    button.onclick = () => {activePanel=id;setPanel();}; tabs.append(button);
  }
  body.append(overview,requirements,benchmarks); $('detail').append(tabs,body);
  function setPanel() {for (const id of ['overview','requirements','benchmarks']) {const selected=id===activePanel; $('panel-'+id).hidden=!selected;$('panel-'+id).setAttribute('role','tabpanel');$('panel-'+id).setAttribute('aria-labelledby','tab-'+id);$('tab-'+id).setAttribute('aria-selected',String(selected));} body.scrollTop=0; animatePanel($('panel-'+activePanel));}
  setPanel();
  const updateStorage = () => {
    const drive = profile?.drives[Number($('drive').value)];
    $('storage').textContent = !drive ? 'Select a profile first' : storage === null ? 'Storage requirement unknown' : `${drive.freeGb >= storage ? 'Enough space' : 'Below minimum'} · ${storage} GB required`;
    $('storage').className = drive && storage !== null && drive.freeGb < storage ? 'bad' : 'muted';
  };
  $('drive').onchange = updateStorage; updateStorage();
  $('resolution').onchange = () => {renderFps();renderPublicBenchmarks();}; $('preset').onchange = () => {renderFps();renderPublicBenchmarks();};
  setupPublicBenchmarks(); setupEstimates();
}
$('export').onclick = async () => {try {await api.export(JSON.stringify({createdAt:new Date().toISOString(),profile,game,estimate:currentEstimate,deviceResults:deviceRows},null,2));}catch(e){status(e.message,true);}};


function animatePanel(element) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  element.getAnimations().forEach(animation=>animation.cancel());
  element.animate([{opacity:0,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.2,.75,.25,1)'});
}
