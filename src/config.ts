import { HiggsfieldConfigurationError } from './errors.js'
import type { PollOptions } from './types.js'

export type AuthMode = 'headers' | 'authorization'

export interface HiggsfieldLogger {
  debug?(message: string, metadata?: Record<string, unknown>): void
  info?(message: string, metadata?: Record<string, unknown>): void
  warn?(message: string, metadata?: Record<string, unknown>): void
  error?(message: string, metadata?: Record<string, unknown>): void
}

export interface RetryOptions {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffFactor: number
  jitterRatio: number
  retryStatusCodes: readonly number[]
  retryMethods: readonly string[]
}

export interface HiggsfieldClientOptions {
  apiKey?: string
  apiSecret?: string
  /**
   * Backward-compatible combined key (`api-key:api-secret`). When apiSecret is
   * also supplied, this value is treated as the API key only.
   */
  key?: string
  authMode?: AuthMode
  baseUrl?: string
  callbackUrl?: string | false
  fetch?: typeof fetch
  timeoutMs?: number
  headers?: HeadersInit
  userAgent?: string | false
  validateRequests?: boolean
  retry?: Partial<RetryOptions>
  polling?: Omit<PollOptions, 'signal' | 'onStatus'>
  logger?: HiggsfieldLogger
}

export interface ResolvedCredentials {
  apiKey: string
  apiSecret: string
}

export interface ResolvedHiggsfieldConfig {
  credentials: ResolvedCredentials
  authMode: AuthMode
  baseUrl: string
  callbackUrl?: string
  fetch: typeof fetch
  timeoutMs: number
  headers: Headers
  userAgent: string | false
  validateRequests: boolean
  retry: RetryOptions
  polling: Required<
    Pick<
      PollOptions,
      | 'intervalMs'
      | 'maxIntervalMs'
      | 'backoffFactor'
      | 'jitterRatio'
      | 'timeoutMs'
      | 'maxAttempts'
      | 'emitUnchangedStatus'
    >
  >
  logger?: HiggsfieldLogger
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 2,
  initialDelayMs: 250,
  maxDelayMs: 5_000,
  backoffFactor: 2,
  jitterRatio: 0.2,
  retryStatusCodes: [408, 425, 429, 500, 502, 503, 504],
  retryMethods: ['GET'],
}

const DEFAULT_POLLING = {
  intervalMs: 1_000,
  maxIntervalMs: 10_000,
  backoffFactor: 1.5,
  jitterRatio: 0.2,
  timeoutMs: 10 * 60_000,
  maxAttempts: Number.POSITIVE_INFINITY,
  emitUnchangedStatus: false,
} as const

export function resolveConfig(options: HiggsfieldClientOptions = {}): ResolvedHiggsfieldConfig {
  const env = getEnvironment()
  const credentials = resolveCredentials(options, env)
  const fetchImplementation = options.fetch ?? globalThis.fetch

  if (typeof fetchImplementation !== 'function') {
    throw new HiggsfieldConfigurationError(
      'No Fetch implementation is available. Use Node.js 18.17+ or provide options.fetch.',
    )
  }

  const baseUrl = normalizeBaseUrl(
    firstNonEmpty(options.baseUrl, env['HIGGSFIELD_BASE_URL']) ??
      'https://platform.higgsfield.ai',
  )
  const callbackValue =
    options.callbackUrl === false
      ? undefined
      : firstNonEmpty(options.callbackUrl, env['HIGGSFIELD_CALLBACK'])
  const callbackUrl =
    callbackValue === undefined ? undefined : normalizeHttpUrl(callbackValue, 'callbackUrl')
  const timeoutMs = positiveNumber(options.timeoutMs ?? 30_000, 'timeoutMs')

  const retry: RetryOptions = {
    ...DEFAULT_RETRY,
    ...options.retry,
  }

  validateRetryOptions(retry)

  const polling = {
    ...DEFAULT_POLLING,
    ...options.polling,
  }

  validatePollingOptions(polling)

  return {
    credentials,
    authMode: options.authMode ?? 'headers',
    baseUrl,
    ...(callbackUrl !== undefined ? { callbackUrl } : {}),
    fetch: fetchImplementation,
    timeoutMs,
    headers: new Headers(options.headers),
    userAgent: options.userAgent ?? '@digitlimit/higgsfield/0.2.0',
    validateRequests: options.validateRequests ?? true,
    retry,
    polling,
    ...(options.logger !== undefined ? { logger: options.logger } : {}),
  }
}

function resolveCredentials(
  options: HiggsfieldClientOptions,
  env: Record<string, string | undefined>,
): ResolvedCredentials {
  const optionKey = firstNonEmpty(options.key)
  const optionKeyIsCombined = optionKey?.includes(':') === true && options.apiSecret === undefined
  const combined = firstNonEmpty(
    optionKeyIsCombined ? optionKey : undefined,
    env['HF_KEY'],
  )

  let apiKey = firstNonEmpty(
    options.apiKey,
    optionKeyIsCombined ? undefined : optionKey,
    env['HIGGSFIELD_KEY'],
    env['HF_API_KEY'],
  )
  let apiSecret = firstNonEmpty(
    options.apiSecret,
    env['HIGGSFIELD_SECRET'],
    env['HF_API_SECRET'],
  )

  if (combined !== undefined) {
    const separator = combined.indexOf(':')
    if (separator <= 0 || separator === combined.length - 1) {
      throw new HiggsfieldConfigurationError(
        'HF_KEY/key must use the format "api-key:api-secret".',
      )
    }

    apiKey ??= combined.slice(0, separator)
    apiSecret ??= combined.slice(separator + 1)
  }

  if (apiKey === undefined || apiSecret === undefined) {
    throw new HiggsfieldConfigurationError(
      'Higgsfield credentials are required. Set HIGGSFIELD_KEY and HIGGSFIELD_SECRET, set HF_API_KEY and HF_API_SECRET, set HF_KEY, or pass credentials to createHiggsfield().',
    )
  }

  return { apiKey, apiSecret }
}

function getEnvironment(): Record<string, string | undefined> {
  const runtime = globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> }
  }

  return runtime.process?.env ?? {}
}

function normalizeBaseUrl(value: string): string {
  return normalizeHttpUrl(value, 'baseUrl').replace(/\/$/, '')
}

function normalizeHttpUrl(value: string, field: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw new HiggsfieldConfigurationError(`${field} must be a valid absolute URL.`, {
      cause: error,
    })
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HiggsfieldConfigurationError(`${field} must use HTTP or HTTPS.`)
  }

  return url.toString()
}

function firstNonEmpty(...values: Array<string | false | undefined>): string | undefined {
  return values.find((value): value is string => typeof value === 'string' && value.trim() !== '')?.trim()
}

function positiveNumber(value: number, field: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new HiggsfieldConfigurationError(`${field} must be a positive number.`)
  }

  return value
}

function validateRetryOptions(options: RetryOptions): void {
  if (!Number.isInteger(options.maxRetries) || options.maxRetries < 0) {
    throw new HiggsfieldConfigurationError('retry.maxRetries must be a non-negative integer.')
  }

  positiveNumber(options.initialDelayMs, 'retry.initialDelayMs')
  positiveNumber(options.maxDelayMs, 'retry.maxDelayMs')
  positiveNumber(options.backoffFactor, 'retry.backoffFactor')

  if (options.jitterRatio < 0 || options.jitterRatio > 1) {
    throw new HiggsfieldConfigurationError('retry.jitterRatio must be between 0 and 1.')
  }
}

function validatePollingOptions(options: {
  intervalMs: number
  maxIntervalMs: number
  backoffFactor: number
  jitterRatio: number
  timeoutMs: number
  maxAttempts: number
  emitUnchangedStatus: boolean
}): void {
  if (options.intervalMs < 0 || !Number.isFinite(options.intervalMs)) {
    throw new HiggsfieldConfigurationError('polling.intervalMs must be zero or greater.')
  }

  if (options.maxIntervalMs < 0 || !Number.isFinite(options.maxIntervalMs)) {
    throw new HiggsfieldConfigurationError('polling.maxIntervalMs must be zero or greater.')
  }

  positiveNumber(options.backoffFactor, 'polling.backoffFactor')
  positiveNumber(options.timeoutMs, 'polling.timeoutMs')

  if (options.jitterRatio < 0 || options.jitterRatio > 1) {
    throw new HiggsfieldConfigurationError('polling.jitterRatio must be between 0 and 1.')
  }

  if (options.maxAttempts <= 0 || Number.isNaN(options.maxAttempts)) {
    throw new HiggsfieldConfigurationError('polling.maxAttempts must be greater than zero.')
  }
}
