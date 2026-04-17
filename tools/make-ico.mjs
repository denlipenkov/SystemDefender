import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import pngToIco from 'png-to-ico';

const repoRoot = process.cwd();
const srcPng = path.join(repoRoot, 'assets', 'icon.png');
const outIco = path.join(repoRoot, 'assets', 'icon.ico');

async function main() {
  try {
    await fs.access(srcPng);
  } catch {
    console.error(`icon source not found: ${srcPng}`);
    process.exit(1);
  }

  const buf = await pngToIco(srcPng);
  await fs.writeFile(outIco, buf);
  console.log(`wrote: ${outIco}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

