// Une las 5 imágenes aprobadas (assets/stills-draft/*.png) en UN solo video
// continuo con movimientos de cámara suaves entre cada una, usando Kling O3
// (first/last frame). El resultado final queda en assets/bg/recorrido.mp4.
//
// Uso: node --env-file=.env scripts/generate-unified-video.mjs

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import ffmpegPath from 'ffmpeg-static';

const run = promisify(execFile);

const API_KEY = process.env.HIGGSFIELD_API_KEY;
if (!API_KEY) {
  console.error('Falta HIGGSFIELD_API_KEY.');
  process.exit(1);
}

const STILLS_DIR = path.resolve(import.meta.dirname, '..', 'assets', 'stills-draft');
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'assets', 'bg');
const CLIPS_DIR = path.join(STILLS_DIR, 'clips');

const SEQUENCE = ['hero', 'servicios', 'portafolio', 'nosotros', 'contacto'];

const TRANSITIONS = [
  {
    from: 'hero',
    to: 'servicios',
    prompt: 'Slow cinematic dolly out, the camera smoothly pulls back from the glowing lens aperture revealing a dark professional video production studio with camera rigs and softbox lights glowing magenta pink. Continuous smooth camera movement, no cuts, cinematic color grade.',
  },
  {
    from: 'servicios',
    to: 'portafolio',
    prompt: 'Slow cinematic camera pan and dolly, smoothly moving past the production studio towards a dark wall covered in glowing screens and monitors playing video reels. Continuous smooth camera movement, no cuts, cinematic color grade.',
  },
  {
    from: 'portafolio',
    to: 'nosotros',
    prompt: 'Slow cinematic camera drift, smoothly moving from the wall of glowing screens towards a network of glowing magenta light threads connecting silhouettes of people in a dark room. Continuous smooth camera movement, no cuts, cinematic color grade.',
  },
  {
    from: 'nosotros',
    to: 'contacto',
    prompt: 'Slow cinematic camera push in, smoothly moving from the network of connected lights towards a single pulsing magenta signal of light in near-total darkness. Continuous smooth camera movement, no cuts, cinematic color grade.',
  },
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadImage(name) {
  const filePath = path.join(STILLS_DIR, `${name}.png`);
  const bytes = await readFile(filePath);

  const createRes = await fetch('https://api.higgsfield.ai/files/generate-upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Key ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content_type: 'image/png' }),
  });
  if (!createRes.ok) throw new Error(`generate-upload-url failed (${createRes.status}): ${await createRes.text()}`);
  const { public_url, upload_url, upload_headers } = await createRes.json();

  const putRes = await fetch(upload_url, {
    method: 'PUT',
    headers: upload_headers,
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`upload failed (${putRes.status}): ${await putRes.text()}`);

  return public_url;
}

async function submitTransition(firstUrl, lastUrl, prompt) {
  const res = await fetch('https://api.higgsfield.ai/kling-video/o3/first-last-frame', {
    method: 'POST',
    headers: {
      Authorization: `Key ${API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      prompt,
      first_frame_url: firstUrl,
      last_frame_url: lastUrl,
      mode: 'std',
      duration: 5,
      aspect_ratio: '16:9',
      sound: 'off',
      multi_shots: false,
    }),
  });
  if (!res.ok) throw new Error(`Submit failed (${res.status}): ${await res.text()}`);
  return res.json();
}

async function pollUntilDone(statusUrl) {
  while (true) {
    const res = await fetch(statusUrl, { headers: { Authorization: `Key ${API_KEY}` } });
    if (!res.ok) throw new Error(`Status check failed (${res.status}): ${await res.text()}`);
    const data = await res.json();
    if (data.status === 'completed') return data;
    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`Generation failed: ${JSON.stringify(data)}`);
    }
    process.stdout.write('.');
    await sleep(5000);
  }
}

async function downloadTo(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  await mkdir(CLIPS_DIR, { recursive: true });
  await mkdir(OUT_DIR, { recursive: true });

  console.log('→ Subiendo imágenes aprobadas...');
  const urls = {};
  for (const name of SEQUENCE) {
    urls[name] = await uploadImage(name);
    console.log(`  ✓ ${name}: ${urls[name]}`);
  }

  const clipPaths = [];
  for (let i = 0; i < TRANSITIONS.length; i++) {
    const t = TRANSITIONS[i];
    console.log(`\n→ Generando transición "${t.from}" → "${t.to}"...`);
    const submitted = await submitTransition(urls[t.from], urls[t.to], t.prompt);
    process.stdout.write('  esperando');
    const result = await pollUntilDone(submitted.status_url);
    const videoUrl = result.video?.url;
    if (!videoUrl) throw new Error(`Sin URL de video: ${JSON.stringify(result)}`);
    const clipPath = path.join(CLIPS_DIR, `${i + 1}-${t.from}-${t.to}.mp4`);
    await downloadTo(videoUrl, clipPath);
    clipPaths.push(clipPath);
    console.log(`\n  ✓ Guardado en ${clipPath}`);
  }

  console.log('\n→ Uniendo los 4 clips en un solo video...');
  const listFile = path.join(CLIPS_DIR, 'concat-list.txt');
  const listContent = clipPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await writeFile(listFile, listContent);

  const finalPath = path.join(OUT_DIR, 'recorrido.mp4');
  await run(ffmpegPath, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    finalPath,
  ]);

  console.log(`\nListo. Video unificado en ${finalPath}`);
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
