// Genera las imágenes fijas (una por sección) del recorrido cinematográfico
// usando SOUL Cinema (Higgsfield API). Se revisan/aprueban antes de unificarlas
// en un solo video con Kling.
//
// Uso: node --env-file=.env scripts/generate-stills.mjs

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API_KEY = process.env.HIGGSFIELD_API_KEY;
if (!API_KEY) {
  console.error('Falta HIGGSFIELD_API_KEY.');
  process.exit(1);
}

const ENDPOINT = 'https://api.higgsfield.ai/higgsfield-ai/soul/cinema';
const OUT_DIR = path.resolve(import.meta.dirname, '..', 'assets', 'stills-draft');

const STYLE = 'shallow depth of field, moody professional studio atmosphere, dust particles and haze in the air, black background with magenta pink rim lighting, 35mm anamorphic lens, cinematic color grade, ultra realistic photography, no text, no logos';

const JOBS = [
  {
    name: 'servicios',
    prompt: `Cinematic wide shot of a professional video production studio at night, camera rigs and tripods, softbox lights glowing magenta pink, editing monitors glowing in the background, ${STYLE}`,
  },
  {
    name: 'portafolio',
    prompt: `Cinematic wide shot of a dark wall covered in glowing screens and monitors playing video reels, a 35mm film strip hanging nearby catching the light, magenta pink ambient light reflecting off the glass, ${STYLE}`,
  },
  {
    name: 'nosotros',
    prompt: `Cinematic wide shot of a dark room with a network of glowing magenta pink light threads connecting suspended points in the air, soft silhouettes of people standing in the distance, atmospheric haze, ${STYLE}`,
  },
  {
    name: 'contacto',
    prompt: `Cinematic close-up of a glowing magenta pink light pulse radiating outward like a signal wave in near-total darkness, soft smoke in the air, ${STYLE}`,
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
      resolution: '1080p',
      aspect_ratio: '16:9',
      enhance_prompt: true,
      batch_size: 1,
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
    await sleep(3000);
  }
}

async function downloadTo(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const job of JOBS) {
    console.log(`\n→ Generando "${job.name}"...`);
    const submitted = await submit(job.prompt);
    process.stdout.write('  esperando');
    const result = await pollUntilDone(submitted.status_url);
    const url = result.images?.[0]?.url;
    if (!url) throw new Error(`Sin URL de imagen: ${JSON.stringify(result)}`);
    const outPath = path.join(OUT_DIR, `${job.name}.png`);
    await downloadTo(url, outPath);
    console.log(`\n  ✓ Guardado en ${outPath}`);
  }
  console.log('\nListo.');
}

main().catch((err) => {
  console.error('\nError:', err.message);
  process.exit(1);
});
