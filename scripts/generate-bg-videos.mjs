// Genera los 5 videos de fondo (Hero, Servicios, Portafolio/CTA, Nosotros, Contacto)
// usando la API de Higgsfield (Seedance 2.5 text-to-video) y los descarga a assets/bg/.
//
// Uso: node --env-file=.env scripts/generate-bg-videos.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.HIGGSFIELD_API_KEY;
if (!API_KEY) {
  console.error('Falta HIGGSFIELD_API_KEY. Corre con: node --env-file=.env scripts/generate-bg-videos.mjs');
  process.exit(1);
}

const ENDPOINT = 'https://api.higgsfield.ai/bytedance/seedance-2.5/text-to-video';
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'assets', 'bg');

const JOBS = [
  {
    name: 'hero',
    prompt: 'Abstract motion graphics loop, flowing liquid black smoke and glowing magenta pink light trails, slow cinematic camera drift, particles and light streaks on pure black background, minimal, elegant, no text, no people',
  },
  {
    name: 'servicios',
    prompt: 'Abstract motion graphics loop, floating geometric shapes forming a subtle camera aperture and lens flare, glowing magenta pink light on pure black background, slow smooth rotation, minimal, elegant, no text, no people',
  },
  {
    name: 'portafolio',
    prompt: 'Abstract motion graphics loop, floating film strip and play-button shaped light particles drifting through glowing magenta streaks on black background, cinematic slow motion, minimal, elegant, no text, no people',
  },
  {
    name: 'nosotros',
    prompt: 'Abstract motion graphics loop, glowing magenta particles connecting into a network of nodes and lines, slow orbiting motion on pure black background, minimal, elegant, no text, no people',
  },
  {
    name: 'contacto',
    prompt: 'Abstract motion graphics loop, glowing magenta signal waves and message bubble shaped light particles pulsing outward on black background, slow smooth motion, minimal, elegant, no text, no people',
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function submit(prompt) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Key ${API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      prompt,
      duration: 6,
      resolution: '720p',
      aspect_ratio: '16:9',
      bitrate_mode: 'standard',
      output_format: 'mp4',
      generate_audio: false,
    }),
  });
  if (!res.ok) {
    throw new Error(`Submit failed (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function pollUntilDone(statusUrl) {
  while (true) {
    const res = await fetch(statusUrl, {
      headers: { Authorization: `Key ${API_KEY}` },
    });
    if (!res.ok) {
      throw new Error(`Status check failed (${res.status}): ${await res.text()}`);
    }
    const data = await res.json();
    if (data.status === 'completed') return data;
    if (data.status === 'failed' || data.status === 'error') {
      throw new Error(`Generation failed: ${JSON.stringify(data)}`);
    }
    process.stdout.write('.');
    await sleep(4000);
  }
}

async function downloadTo(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buf);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  for (const job of JOBS) {
    console.log(`\n→ Generando "${job.name}"...`);
    const submitted = await submit(job.prompt);
    console.log(`  request_id: ${submitted.request_id}`);
    process.stdout.write('  esperando');
    const result = await pollUntilDone(submitted.status_url);
    const videoUrl = result.video?.url;
    if (!videoUrl) throw new Error(`Sin URL de video en la respuesta: ${JSON.stringify(result)}`);
    const outPath = path.join(OUT_DIR, `${job.name}.mp4`);
    await downloadTo(videoUrl, outPath);
    console.log(`\n  ✓ Guardado en ${outPath}`);
  }

  console.log('\nListo. Todos los videos de fondo generados en assets/bg/.');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
