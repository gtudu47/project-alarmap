import { BadRequestException } from '@nestjs/common';
import type { z } from 'zod';

/** Les erreurs ne reprennent jamais les valeurs saisies (mots de passe, tokens). */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new BadRequestException('Vérifiez les champs du formulaire.');
  return parsed.data;
}
