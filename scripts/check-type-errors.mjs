// Type-check ratchet: fails if `tsc --noEmit` reports MORE errors than the number in
// .tsc-baseline. Lower the number in .tsc-baseline whenever the count drops; when it
// reaches 0, delete this script and turn off typescript.ignoreBuildErrors in next.config.js.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const baseline = parseInt(readFileSync(new URL('../.tsc-baseline', import.meta.url), 'utf8').trim(), 10);
if (!Number.isFinite(baseline)) {
  console.error('.tsc-baseline must contain a number');
  process.exit(1);
}

const run = spawnSync('npx', ['tsc', '--noEmit', '-p', '.'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const output = `${run.stdout || ''}${run.stderr || ''}`;
const errors = output.split('\n').filter(line => /error TS\d+/.test(line));

if (run.error || (errors.length === 0 && run.status !== 0)) {
  console.error('tsc did not run correctly:\n', run.error || output.slice(0, 2000));
  process.exit(1);
}

console.log(`Type errors: ${errors.length} (baseline ${baseline})`);
if (errors.length > baseline) {
  console.error(`\n${errors.length - baseline} more type error(s) than the baseline. Fix the new errors.`);
  console.error('Run `npx tsc --noEmit -p .` locally and look at the files you changed.');
  process.exit(1);
}
if (errors.length < baseline) {
  console.log(`\nFewer errors than the baseline. Please lower .tsc-baseline to ${errors.length} in this pull request.`);
}
