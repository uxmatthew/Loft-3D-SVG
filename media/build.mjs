// Renders the README animations. Run with `npm run media` after `npm run build`.
// Needs Node 22+, FFmpeg and Chrome. The composition is media/animations/index.html, a
// HyperFrames project (https://hyperframes.heygen.com); its clips are cut into one GIF each.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, statSync } from 'node:fs';

const assets = 'media/animations/assets';
mkdirSync(assets, { recursive: true });
for (const f of ['dist/loft.global.js', 'demo/catalogue.js', 'demo/models/figure.js', 'demo/icons/icons.js', 'demo/icons/spot-icons.js']) copyFileSync(f, `${assets}/${f.split('/').pop()}`);

const run = (cmd, args, opts = {}) => execFileSync(cmd, args, { stdio: 'inherit', ...opts });
run('npx', ['--yes', 'hyperframes@0.9.58', 'render', '--quality', 'looks', '-o', '../loft.mp4'], {
  cwd: 'media/animations',
  env: { ...process.env, HYPERFRAMES_NO_TELEMETRY: '1' },
});

// [name, start, duration] in seconds, as laid out in the composition.
const clips = [['spots', 0, 4], ['icons', 4, 4], ['looks', 8, 6], ['grow', 14, 4], ['morph', 18, 4], ['rotate', 22, 4], ['model', 26, 4]];
for (const [name, start, duration] of clips) {
  const out = `media/${name}.gif`;
  run('ffmpeg', [
    '-loglevel', 'error', '-y', '-ss', String(start), '-t', String(duration), '-i', 'media/loft.mp4',
    '-vf', 'fps=15,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle',
    '-loop', '0', out,
  ]);
  console.log(`${out.padEnd(20)} ${(statSync(out).size / 1024).toFixed(0).padStart(5)} kB`);
}
