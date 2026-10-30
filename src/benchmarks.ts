export const datasetUrl = 'https://techfuelhq.com/data/gpu/rog-astral-rtx-5080-oc-2026-06-09/dataset.json';
export const sourceUrl = 'https://techfuelhq.com/data/gpu/rog-astral-rtx-5080-oc-2026-06-09/';
export type PublicBenchmark = { gameId: number | null; game: string; cpu: string; gpu: string; ram: number; resolution: string; preset: string; mode: string; fps: number; low: number | null; date: string; source: string; publisher: string; license: string };
const games: Record<string, { id: number | null; name: string; preset: string; mode: string }> = {
  'Cyberpunk Ultra (raster)': { id: 1091500, name: 'Cyberpunk 2077', preset: 'Ultra', mode: 'Native raster · RT off' },
  'Cyberpunk RT-Ultra + DLSS-Q': { id: 1091500, name: 'Cyberpunk 2077', preset: 'Ultra', mode: 'RT Ultra · DLSS Quality' },
  'Cyberpunk Path Tracing (native)': { id: 1091500, name: 'Cyberpunk 2077', preset: 'Overdrive', mode: 'Native path tracing' },
  'Alan Wake 2 RT + DLSS-Q': { id: null, name: 'Alan Wake 2', preset: 'Unspecified', mode: 'RT on · DLSS Quality' },
  'Black Myth: Wukong Cinematic': { id: 2358720, name: 'Black Myth: Wukong', preset: 'Cinematic', mode: 'Native · RT unspecified' }
};
export function parsePublicBenchmarks(data: any): PublicBenchmark[] {
  if (data?.dataset_id !== 'rog-astral-rtx-5080-oc-2026-06-09' || data?.license?.spdx_id !== 'CC-BY-4.0') throw new Error('Benchmark source format changed.');
  const chart = data.charts?.find((x: any) => x.chart_id === '06-4k-gaming');
  if (!Array.isArray(chart?.data_points) || typeof data.system_under_test?.cpu !== 'string' || typeof data.system_under_test?.gpu !== 'string') throw new Error('Benchmark source format changed.');
  return chart.data_points.flatMap((point: any) => {
    const game = games[point.label];
    if (!game || !Number.isFinite(point.avg_fps) || point.avg_fps <= 0) return [];
    return [{ gameId: game.id, game: game.name, cpu: data.system_under_test.cpu, gpu: data.system_under_test.gpu, ram: 64, resolution: '3840×2160', preset: game.preset, mode: game.mode, fps: point.avg_fps, low: Number.isFinite(point.low_1pct_fps) ? point.low_1pct_fps : null, date: data.system_under_test.test_date_window, source: sourceUrl, publisher: 'TechFuelHQ / Lowell K. Wood IV', license: 'CC BY 4.0' }];
  });
}
