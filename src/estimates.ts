export const modelBase = 'https://raw.githubusercontent.com/emilioagustin83/pc-game-fps-dataset/main/data/';
export function csv(text: string): Record<string,string>[] {
  const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i=0;i<text.length;i++) {
    const c=text[i];
    if(c==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted; }
    else if(c===','&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';}
    else cell+=c;
  }
  if(cell||row.length){row.push(cell.replace(/\r$/,''));rows.push(row);}
  const header=rows.shift()??[];
  return rows.filter(r=>r.length===header.length).map(r=>Object.fromEntries(header.map((key,i)=>[key,r[i]])));
}
export const hardwareKey = (name: string) => name.toLowerCase().replace(/\(tm\)|\(r\)/g,'').replace(/\b(nvidia|amd|intel|geforce|radeon|graphics)\b/g,'').replace(/[^a-z0-9]/g,'');
const references: Record<string,string> = {iris_xe:'Intel Iris Xe',radeon_780m:'Radeon 780M',gtx_1650:'GeForce GTX 1650',gtx_1660_super:'GeForce GTX 1660 SUPER',rtx_3060:'GeForce RTX 3060',rx_7600:'Radeon RX 7600',rtx_4060:'GeForce RTX 4060',rtx_5060:'GeForce RTX 5060',rtx_4070:'GeForce RTX 4070',rx_7800_xt:'Radeon RX 7800 XT',rtx_5070:'GeForce RTX 5070',rtx_4090:'GeForce RTX 4090'};
export function estimateModel(games: Record<string,string>[], gpus: Record<string,string>[], input: {id: number|string;name:string;gpu:string}) {
  const game=games.find(row=>String(input.id)===row.steam_appid) ?? (typeof input.id==='string' ? games.find(row=>row.name.toLowerCase()===input.name.toLowerCase()) : undefined);
  if(!game) return {available:false,reason:'Game not covered by the model.'};
  const gpu=gpus.find(row=>hardwareKey(row.name)===hardwareKey(input.gpu));
  if(!gpu) return {available:false,reason:'GPU not recognized by the model.'};
  const exact=Object.entries(references).find(([,name])=>hardwareKey(name)===hardwareKey(gpu.name));
  let fps=exact ? Number(game['fps_1080p_high_'+exact[0]]) : 0;
  let method='Provider estimate';
  if(!fps) {
    const points=Object.entries(references).flatMap(([key,name])=>{
      const score=Number(gpus.find(row=>hardwareKey(row.name)===hardwareKey(name))?.g3d_mark);
      const value=Number(game['fps_1080p_high_'+key]);
      return score>0&&value>0 ? [{score,value}] : [];
    }).sort((a,b)=>a.score-b.score);
    const score=Number(gpu.g3d_mark), lower=points.filter(p=>p.score<=score).at(-1), upper=points.find(p=>p.score>=score);
    if(!lower||!upper) return {available:false,reason:'GPU is outside the model reference range.'};
    fps=lower.score===upper.score ? lower.value : lower.value+(upper.value-lower.value)*(score-lower.score)/(upper.score-lower.score);
    method='Bottleneck interpolation of provider estimates';
  }
  const cap=Number(game.engine_fps_cap)||360;
  fps=Math.min(fps,cap);
  return {available:true,fps:Math.round(fps),low:Math.max(1,Math.floor(fps*.6)),high:Math.min(cap,Math.ceil(fps*1.4)),method,gpu:gpu.name,source:game.page_url,conditions:'1080p · High · native raster · no frame generation',confidence:'Low',notes:'GPU model only. CPU, RAM configuration, power limits and game patches are not modeled. ±40% is a heuristic allowance, not a validated confidence interval.',license:'CC BY 4.0',provider:'PCGameBenchmarks'};
}
