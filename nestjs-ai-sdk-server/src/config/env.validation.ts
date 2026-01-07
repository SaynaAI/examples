import { plainToInstance, Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  validateSync,
} from 'class-validator';

/**
 * Environment variable names as constants to avoid typos
 */
export const ENV_KEYS = {
  SAYNA_URL: 'SAYNA_URL',
  SAYNA_API_KEY: 'SAYNA_API_KEY',
  GOOGLE_API_KEY: 'GOOGLE_GENERATIVE_AI_API_KEY',
  PORT: 'PORT',
} as const;

/**
 * Environment variables validation class
 */
export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  @IsUrl({ require_protocol: true, require_tld: false })
  SAYNA_URL!: string;

  @IsOptional()
  @IsString()
  SAYNA_API_KEY?: string;

  @IsString()
  @IsNotEmpty()
  GOOGLE_GENERATIVE_AI_API_KEY!: string;

  @IsOptional()
  @Transform(({ value }: { value: string | undefined }) =>
    value ? parseInt(value, 10) : 4000,
  )
  @IsInt()
  @IsPositive()
  PORT = 4000;
}

/**
 * Validated environment variables type for ConfigService
 */
export type ValidatedEnv = EnvironmentVariables;

/**
 * Validates and transforms environment variables at application startup.
 * Throws descriptive errors if required variables are missing or invalid.
 */
export function validate(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorMessages = errors
      .map((error) => {
        const constraints = error.constraints
          ? Object.values(error.constraints).join(', ')
          : 'unknown error';
        return `  - ${error.property}: ${constraints}`;
      })
      .join('\n');

    throw new Error(`Environment validation failed:\n${errorMessages}`);
  }

  return validatedConfig;
}
