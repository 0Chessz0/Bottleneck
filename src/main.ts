import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { plain } from './requirements.js';
import { datasetUrl, parsePublicBenchmarks } from './benchmarks.js';
import { csv, estimateModel, modelBase } from './estimates.js';
const run = promisify(execFile);
const cache = new Map<string, { expires: number; data: any }>();
async function store(endpoint: string) {
  const hit = cache.get(endpoint);
  if (hit && hit.expires > Date.now()) return hit.data;
  const response = await fetch('https://store.steampowered.com/api/' + endpoint, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Steam returned ${response.status}. Try again later.`);
  const data = await response.json();
  cache.set(endpoint, { data, expires: Date.now() + 3600000 });
  return data;
}
app.whenReady().then(() => {
  let modelPromise: Promise<{games:Record<string,string>[];gpus:Record<string,string>[]}> | null = null;
  const model = () => modelPromise ??= Promise.all(['games.csv','gpus.csv'].map(async file => {
    const response=await fetch(modelBase+file,{signal:AbortSignal.timeout(25000)});
    if(!response.ok) throw new Error('Model dataset unavailable.');
    const rows=csv(await response.text());
    if(!rows.length || !(file==='games.csv' ? 'steam_appid' in rows[0] : 'g3d_mark' in rows[0])) throw new Error('Model dataset format changed.');
    return rows;
  })).then(([games,gpus])=>({games,gpus})).catch(error=>{modelPromise=null;throw error;});
  ipcMain.handle('estimate',async (_,input)=>{
    if(!input||!['string','number'].includes(typeof input.id)||typeof input.name!=='string'||typeof input.gpu!=='string'||input.name.length>250||input.gpu.length>250) throw new Error('Invalid estimate request.');
    const data=await model();return estimateModel(data.games,data.gpus,input);
  });
  ipcMain.handle('deviceResults',async (_,input)=>{
    if(!input||typeof input.name!=='string'||input.name.length>250) throw new Error('Invalid game.');
    const key='device:'+input.id; const hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.data;
    const response=await fetch('https://steamfps.com/api/v1/search?q='+encodeURIComponent(input.name)+'&limit=10',{signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('SteamFPS unavailable.');
    const data=await response.json() as any;
    const game=(data.games??[]).find((g:any)=>String(g.appid)===String(input.id)||(typeof input.id==='string'&&g.title?.toLowerCase()===input.name.toLowerCase()));
    const rows=game ? ['steamDeck','steamMachine'].flatMap(device=>{
      const item=game[device];if(!item)return [];
      if(device==='steamDeck')return Number.isFinite(item.fps)&&item.fps>0 ? [{device:'Steam Deck',fps:item.fps,resolution:item.resolution??'Unspecified',preset:'Unspecified',mode:'Settings unspecified',basis:item.provenance??'Unspecified',source:game.url}] : [];
      return Object.entries(item.tiers??{}).flatMap(([preset,row]:[string,any])=>Number.isFinite(row.fps)&&row.fps>0 ? [{device:'Steam Machine',fps:row.fps,resolution:row.resolution??'Unspecified',preset,mode:'Upscaling: '+(row.upscaler??'unspecified'),basis:item.provenance??'Unspecified',source:game.url}] : []);
    }):[];
    cache.set(key,{data:rows,expires:Date.now()+3600000});return rows;
  });
  ipcMain.handle('openDataSource',async(_,value)=>{
    if(typeof value!=='string'||value.length>500)throw new Error('Invalid source.');
    const url=new URL(value);
    if(url.protocol!=='https:'||!['pcgamebenchmarks.com','steamfps.com','techfuelhq.com'].includes(url.hostname)||url.username||url.password)throw new Error('Unsupported source.');
    await shell.openExternal(url.href);
  });
  ipcMain.handle('publicBenchmarks', async () => {
    const cached = cache.get(datasetUrl);
    if (cached && cached.expires > Date.now()) return cached.data;
    const response = await fetch(datasetUrl, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Public benchmarks are temporarily unavailable.');
    const rows = parsePublicBenchmarks(await response.json());
    cache.set(datasetUrl, { data: rows, expires: Date.now() + 3600000 });
    return rows;
  });
  ipcMain.handle('openResearch', async (_, input) => {
    if (!input || typeof input.query !== 'string' || input.query.length > 500) throw new Error('Invalid benchmark search.');
    const base = input.provider === 'youtube' ? 'https://www.youtube.com/results?search_query=' : input.provider === 'google' ? 'https://www.google.com/search?q=' : null;
    if (!base) throw new Error('Unknown search provider.');
    await shell.openExternal(base + encodeURIComponent(input.query));
  });
  ipcMain.handle('openBenchmarkSource', async () => {
    await shell.openExternal('https://techfuelhq.com/data/gpu/rog-astral-rtx-5080-oc-2026-06-09/');
  });
  ipcMain.handle('export', async (_, data) => {
    if (typeof data !== 'string' || data.length > 2000000) throw new Error('Invalid report.');
    const result = await dialog.showSaveDialog({ defaultPath: 'bottleneck-report.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!result.canceled && result.filePath) await writeFile(result.filePath, data, 'utf8');
  });
  ipcMain.handle('search', async (_, query) => {
    if (typeof query !== 'string' || query.length > 200) throw new Error('Enter a shorter game title.');
    const data = await store(`storesearch/?term=${encodeURIComponent(query)}&l=english&cc=us`);
    return (data.items ?? []).map((x: any) => ({ id: x.id, name: x.name }));
  });
  ipcMain.handle('game', async (_, id) => {
    if (!Number.isSafeInteger(id) || id < 1) throw new Error('Invalid Steam app ID.');
    const result = await store(`appdetails?appids=${id}&l=english&cc=us`);
    const data = result[id]?.data;
    if (!result[id]?.success || !data) throw new Error('This game is unavailable from Steam.');
    if (data.type !== 'game') throw new Error('Choose a game rather than DLC or software.');
    return { id, name: data.name, minimum: plain(data.pc_requirements?.minimum ?? ''), recommended: plain(data.pc_requirements?.recommended ?? ''), windows: !!data.platforms?.windows, retrievedAt: new Date().toISOString(), source: `https://store.steampowered.com/app/${id}/` };
  });
  ipcMain.handle('scan', async () => {
    if (process.platform !== 'win32') throw new Error('Automatic scanning requires Windows. Use a manual profile.');
    const script = `$ErrorActionPreference='Stop'; $cpu=Get-CimInstance Win32_Processor; $gpu=Get-CimInstance Win32_VideoController; $os=Get-CimInstance Win32_OperatingSystem; $ram=Get-CimInstance Win32_ComputerSystem; $disks=Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3'; [pscustomobject]@{cpu=(@($cpu|ForEach-Object {$_.Name}) -join ', ');gpu=@($gpu|ForEach-Object {$_.Name});ramGb=[math]::Round($ram.TotalPhysicalMemory/1GB,1);os=$os.Caption;drives=@($disks|ForEach-Object {[pscustomobject]@{name=$_.DeviceID;freeGb=[math]::Round($_.FreeSpace/1GB,1)}})}|ConvertTo-Json -Depth 4 -Compress`;
    const { stdout } = await run(path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoProfile', '-NonInteractive', '-Command', script], { timeout: 25000, windowsHide: true, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout.replace(/^\uFEFF/, ''));
  });
  const window = new BrowserWindow({ width: 1180, height: 820, minWidth: 900, minHeight: 680, backgroundColor: '#090909', title: 'Bottleneck', autoHideMenuBar: true, webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(path.join(__dirname, '..', 'ui', 'index.html'));
});
app.on('window-all-closed', () => app.quit());
