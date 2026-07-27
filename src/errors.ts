import type { GenerationResponse, TerminalGenerationResponse, UnknownRecord } from './types.js'

export class HiggsfieldError extends Error {
  public override readonly name: string = 'HiggsfieldError'

  public constructor(message: string, options?: ErrorOptions) {
    super(message, options)
  }
}

export class HiggsfieldConfigurationError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldConfigurationError'
}

export class HiggsfieldValidationError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldValidationError'

  public constructor(
    message: string,
    public readonly field?: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export interface ApiErrorDetails {
  status: number
  method: string
  url: string
  body?: unknown
  headers?: Record<string, string>
  requestId?: string
  retryAfterMs?: number
}

export class HiggsfieldApiError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldApiError'
  public readonly status: number
  public readonly method: string
  public readonly url: string
  public readonly body: unknown | undefined
  public readonly headers: Record<string, string> | undefined
  public readonly requestId: string | undefined
  public readonly retryAfterMs: number | undefined

  public constructor(message: string, details: ApiErrorDetails, options?: ErrorOptions) {
    super(message, options)
    this.status = details.status
    this.method = details.method
    this.url = details.url
    this.body = details.body
    this.headers = details.headers
    this.requestId = details.requestId
    this.retryAfterMs = details.retryAfterMs
  }
}

export class HiggsfieldNetworkError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldNetworkError'
}

export class HiggsfieldAbortError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldAbortError'
}

export class HiggsfieldTimeoutError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldTimeoutError'

  public constructor(
    message: string,
    public readonly timeoutMs: number,
    public readonly lastResponse?: GenerationResponse,
    options?: ErrorOptions,
  ) {
    super(message, options)
  }
}

export class HiggsfieldGenerationError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldGenerationError'

  public constructor(
    message: string,
    public readonly response: Exclude<TerminalGenerationResponse, { status: 'completed' }>,
  ) {
    super(message)
  }
}

export class HiggsfieldWebhookVerificationError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldWebhookVerificationError'
}

export class HiggsfieldWebhookBodyTooLargeError extends HiggsfieldError {
  public override readonly name = 'HiggsfieldWebhookBodyTooLargeError'

  public constructor(
    message: string,
    public readonly maxBodyBytes: number,
  ) {
    super(message)
  }
}

export function describeApiBody(body: unknown): string | undefined {
  if (typeof body === 'string' && body.trim() !== '') {
    return body.trim()
  }

  if (isRecord(body)) {
    const candidates = [body['message'], body['error'], body['detail']]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim() !== '') {
        return candidate.trim()
      }
    }
  }

  return undefined
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
