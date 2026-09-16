import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '-z'], { cwd, encoding: 'utf8' }).split('\0').filter(Boolean);
const forbidden = files.filter((file) =>
  /(^|\/)\.env(?:\..*)?$/.test(file) && file !== '.env.example' ||
  /^(secrets|backups|data)\//.test(file) || file === 'config/database.json' || /\.(pem|key|p12|pfx)$/.test(file),
);
const required = ['LICENSE', '.gitignore', '.env.example', 'README.md', 'version.json'];
const missing = required.filter((file) => !files.includes(file));
if (forbidden.length || missing.length) {
  if (forbidden.length) console.error('Fichiers sensibles suivis :', forbidden.join(', '));
  if (missing.length) console.error('Fichiers obligatoires non suivis :', missing.join(', '));
  process.exitCode = 1;
} else console.info('Contrôle Git réussi : fichiers requis suivis, chemins sensibles exclus.');
