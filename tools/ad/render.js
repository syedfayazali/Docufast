// Draws the ad: node render.js <workdir> [frames|scene N|all]
// frames: writes preview JPEGs of key moments. scene N: encodes one scene to mp4 (one file per scene, same settings).
const { chromium } = require('playwright'); const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const [work, mode = 'frames', arg] = process.argv.slice(2);
const TL = JSON.parse(fs.readFileSync(path.join(work, 'timeline.json')));
const DUR = TL.scenes.map(s => s.dur), FPS = 30;
(async () => {
  const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await pg.addInitScript(d => { window.SCENE_DUR = d; }, DUR);
  await pg.goto('file://' + path.resolve(__dirname, 'ad.html')); await pg.waitForTimeout(400);
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const shot = async (i, t) => { await pg.evaluate(([i, t]) => window.render(i, t), [i, t]); return pg.screenshot({ type: 'jpeg', quality: 92 }); };
  if (mode === 'frames') {
    const marks = JSON.parse(arg); fs.mkdirSync(path.join(work, 'frames'), { recursive: true });
    for (const [i, t] of marks) fs.writeFileSync(path.join(work, 'frames', `s${i}_${t.toFixed(2)}.jpg`), await shot(i, t));
  } else if (mode === 'scene') {
    const i = +arg, n = Math.round(DUR[i] * FPS); fs.mkdirSync(path.join(work, 'scenes'), { recursive: true });
    const tmp = path.join(work, 'scenes', `s${i}.tmp.mp4`), out = path.join(work, 'scenes', `s${i}.mp4`);
    const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', '30', '-movflags', '+faststart', tmp], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise(r => ff.on('close', r));
    for (let f = 0; f < n; f++) { const buf = await shot(i, f / FPS); if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); }
    ff.stdin.end(); const code = await done; if (code === 0) fs.renameSync(tmp, out); else { console.error('ffmpeg failed', code); process.exit(1); }
    console.log('scene', i, 'ok', n, 'frames');
  }
  if (errs.length) console.error('PAGE ERRORS', errs);
  await b.close();
})();
