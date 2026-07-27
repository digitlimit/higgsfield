import type {
  HiggsfieldLogger,
  ResolvedHiggsfieldConfig,
  RetryOptions,
} from './config.js'
import {
  describeApiBody,
  HiggsfieldAbortError,
  HiggsfieldApiError,
  HiggsfieldNetworkError,
  HiggsfieldTimeoutError,
} from './errors.js'
import { isAbortLike, jitter, sleep } from './internal/runtime.js'

export interface TransportRequest {
  method: string
  path: string
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  headers?: HeadersInit
  signal?: AbortSignal
  timeoutMs?: number
}

export interface HttpTransport {
  request<T>(request: TransportRequest): Promise<T>
}

export class FetchTransport implements HttpTransport {
  public constructor(private readonly config: ResolvedHiggsfieldConfig) {}

  public async request<T>(request: TransportRequest): Promise<T> {
    const method = request.method.toUpperCase()
    const retry = this.config.retry
    const retryableMethod = retry.retryMethods.some(
      (allowed) => allowed.toUpperCase() === method,
    )

    let attempt = 0
    let delayMs = retry.initialDelayMs

    while (true) {
      try {
        return await this.perform<T>(request, method, attempt)
      } catch (error) {
        if (request.signal?.aborted === true) {
          throw new HiggsfieldAbortError('The request was aborted.', { cause: error })
        }

        const retryable =
          retryableMethod &&
          attempt < retry.maxRetries &&
          this.isRetryable(error, retry)

        if (!retryable) {
          throw error
        }

        const retryAfterMs =
          error instanceof HiggsfieldApiError ? error.retryAfterMs : undefined
        const waitMs = retryAfterMs ?? jitter(delayMs, retry.jitterRatio)

        this.config.logger?.warn?.('Retrying Higgsfield API request.', {
          method,
          path: request.path,
          attempt: attempt + 1,
          waitMs,
        })

        await sleep(waitMs, request.signal)
        attempt += 1
        delayMs = Math.min(delayMs * retry.backoffFactor, retry.maxDelayMs)
      }
    }
  }

  private async perform<T>(
    request: TransportRequest,
    method: string,
    attempt: number,
  ): Promise<T> {
    const url = this.buildUrl(request.path, request.query)
    const headers = this.buildHeaders(request.headers)
    const timeoutMs = request.timeoutMs ?? this.config.timeoutMs
    const timeoutController = new AbortController()
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      timeoutController.abort()
    }, timeoutMs)

    const combined = combineSignals(request.signal, timeoutController.signal)

    this.config.logger?.debug?.('Sending Higgsfield API request.', {
      method,
      path: request.path,
      attempt,
    })

    try {
      const response = await this.config.fetch(url, {
        method,
        headers,
        ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
        ...(combined.signal !== undefined ? { signal: combined.signal } : {}),
      })

      const payload = await parseResponseBody(response)

      if (!response.ok) {
        const responseHeaders = Object.fromEntries(response.headers.entries())
        const requestId = readRequestId(payload)
        const detail = describeApiBody(payload)
        const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
        const message = detail ?? `Higgsfield API request failed with HTTP ${response.status}.`

        throw new HiggsfieldApiError(message, {
          status: response.status,
          method,
          url: redactUrl(url),
          body: payload,
          headers: responseHeaders,
          ...(requestId !== undefined ? { requestId } : {}),
          ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
        })
      }

      return payload as T
    } catch (error) {
      if (timedOut) {
        throw new HiggsfieldTimeoutError(
          `Higgsfield API request timed out after ${timeoutMs}ms.`,
          timeoutMs,
          undefined,
          { cause: error },
        )
      }

      if (request.signal?.aborted === true || isAbortLike(error)) {
        throw new HiggsfieldAbortError('The request was aborted.', { cause: error })
      }

      if (error instanceof HiggsfieldApiError || error instanceof HiggsfieldTimeoutError) {
        throw error
      }

      throw new HiggsfieldNetworkError('Unable to reach the Higgsfield API.', {
        cause: error,
      })
    } finally {
      clearTimeout(timer)
      combined.cleanup()
    }
  }

  private buildHeaders(requestHeaders?: HeadersInit): Headers {
    const headers = new Headers(this.config.headers)
    new Headers(requestHeaders).forEach((value, key) => headers.set(key, value))

    if (!headers.has('accept')) {
      headers.set('accept', 'application/json')
    }

    if (!headers.has('content-type')) {
      headers.set('content-type', 'application/json')
    }

    if (this.config.userAgent !== false && !headers.has('user-agent')) {
      headers.set('user-agent', this.config.userAgent)
    }

    const { apiKey, apiSecret } = this.config.credentials
    if (this.config.authMode === 'authorization') {
      headers.set('authorization', `Key ${apiKey}:${apiSecret}`)
      headers.delete('hf-api-key')
      headers.delete('hf-secret')
    } else {
      headers.set('hf-api-key', apiKey)
      headers.set('hf-secret', apiSecret)
      headers.delete('authorization')
    }

    return headers
  }

  private buildUrl(
    path: string,
    query?: Record<string, string | number | boolean | null | undefined>,
  ): string {
    const safePath = path.replace(/^\/+/, '')
    const url = new URL(`${this.config.baseUrl}/${safePath}`)

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value))
      }
    }

    return url.toString()
  }

  private isRetryable(error: unknown, options: RetryOptions): boolean {
    if (error instanceof HiggsfieldApiError) {
      return options.retryStatusCodes.includes(error.status)
    }

    return error instanceof HiggsfieldNetworkError || error instanceof HiggsfieldTimeoutError
  }
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined
  }

  const text = await response.text()
  if (text.trim() === '') {
    return undefined
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return text
    }
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

function readRequestId(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return undefined
  }

  const requestId = (payload as Record<string, unknown>)['request_id']
  return typeof requestId === 'string' ? requestId : undefined
}

function parseRetryAfter(value: string | null): number | undefined {
  if (value === null) {
    return undefined
  }

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1_000
  }

  const date = Date.parse(value)
  if (Number.isNaN(date)) {
    return undefined
  }

  return Math.max(0, date - Date.now())
}

function redactUrl(value: string): string {
  const url = new URL(value)
  if (url.searchParams.has('hf_webhook')) {
    url.searchParams.set('hf_webhook', '[redacted]')
  }

  return url.toString()
}

function combineSignals(
  primary?: AbortSignal,
  secondary?: AbortSignal,
): { signal?: AbortSignal; cleanup: () => void } {
  const signals = [primary, secondary].filter(
    (signal): signal is AbortSignal => signal !== undefined,
  )

  if (signals.length === 0) {
    return { cleanup: () => undefined }
  }

  if (signals.length === 1) {
    const signal = signals[0]
    return signal === undefined
      ? { cleanup: () => undefined }
      : { signal, cleanup: () => undefined }
  }

  const controller = new AbortController()
  const listeners: Array<() => void> = []

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason)
      break
    }

    const onAbort = (): void => controller.abort(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    listeners.push(() => signal.removeEventListener('abort', onAbort))
  }

  return {
    signal: controller.signal,
    cleanup: () => listeners.forEach((remove) => remove()),
  }
}
