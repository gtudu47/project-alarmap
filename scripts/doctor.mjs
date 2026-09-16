import { spawnSync } from 'node:child_process';

console.info(`Node.js ${process.version} — ${process.platform}/${process.arch}`);
let failed = false;
for (const [binary, args] of [['git', ['--version']], ['docker', ['version']], ['docker', ['compose', 'version']]]) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 15000 });
  if (result.error || result.status !== 0) { console.error(`${binary} ${args.join(' ')} : indisponible`); failed = true; }
  else console.info(result.stdout.trim());
}
if (failed) process.exitCode = 1;
