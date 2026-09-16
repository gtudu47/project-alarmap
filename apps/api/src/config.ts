import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  TRUST_PROXY: z.coerce.number().int().min(0).max(1).default(0),
  DB_HOST: z.string().min(1), DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
  DB_USER: z.string().min(1), DB_PASSWORD: z.string().min(1), DB_NAME: z.string().regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  JWT_SECRET: z.string().min(1), PUBLIC_APP_URL: z.url(),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'), STORAGE_PATH: z.string().default('./data/assets'),
  S3_ENDPOINT: z.url().default('http://localhost:9000'), S3_BUCKET: z.string().default('alarmap'),
  S3_ACCESS_KEY: z.string().default(''), S3_SECRET_KEY: z.string().default(''), S3_REGION: z.string().default('us-east-1'),
  INSTALL_CHANNEL: z.literal('main').default('main'),
}).superRefine((config, ctx) => {
  if (config.STORAGE_DRIVER === 's3' && (!config.S3_ACCESS_KEY || !config.S3_SECRET_KEY)) {
    ctx.addIssue({ code: 'custom', path: ['S3_ACCESS_KEY'], message: 'Identifiants S3 requis.' });
  }
  if (config.NODE_ENV === 'production') {
    for (const key of ['DB_PASSWORD', 'JWT_SECRET', ...(config.STORAGE_DRIVER === 's3' ? ['S3_SECRET_KEY'] as const : [])] as const) {
      const value = config[key];
      if (value.length < 32 || /change_me|mon_mot_de_passe|example/i.test(value)) {
        ctx.addIssue({ code: 'custom', path: [key], message: 'Secret de production aléatoire requis (32 caractères minimum).' });
      }
    }
  }
});
export type Config = z.infer<typeof configSchema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = configSchema.safeParse(env);
  if (!result.success) throw new Error(`Configuration invalide : ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`);
  return result.data;
}
