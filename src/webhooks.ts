import {
  HiggsfieldValidationError,
  HiggsfieldWebhookBodyTooLargeError,
  HiggsfieldWebhookVerificationError,
} from './errors.js'
import { isTerminalResponse, parseGenerationResponse } from './responses.js'
import type {
  CompletedGenerationResponse,
  FailedGenerationResponse,
  NsfwGenerationResponse,
  CancelledGenerationResponse,
  TerminalGenerationResponse,
} from './types.js'

export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>

export interface WebhookVerificationContext {
  body: string | Uint8Array
  headers: WebhookHeaders
}

export interface ParseWebhookOptions {
  headers?: WebhookHeaders
  verify?: (
    context: WebhookVerificationContext,
  ) => boolean | Promise<boolean>
}

export interface HiggsfieldWebhookRequest {
  method?: string
  body: string | Uint8Array | unknown
  headers?: WebhookHeaders
}

export interface HiggsfieldWebhookContext {
  headers: WebhookHeaders
  receivedAt: Date
  rawBody?: string | Uint8Array
}

export interface WebhookIdempotencyStore {
  /**
   * Atomically reserve a request ID. Return true when this delivery should be
   * processed and false when it has already been handled or reserved.
   */
  acquire(
    requestId: string,
    event: TerminalGenerationResponse,
  ): boolean | Promise<boolean>
  /** Release a reservation when application processing fails. */
  release?(
    requestId: string,
    event: TerminalGenerationResponse,
  ): void | Promise<void>
}

export interface HiggsfieldWebhookEventHandlers {
  completed?: (
    event: CompletedGenerationResponse,
    context: HiggsfieldWebhookContext,
  ) => void | Promise<void>
  failed?: (
    event: FailedGenerationResponse,
    context: HiggsfieldWebhookContext,
  ) => void | Promise<void>
  nsfw?: (
    event: NsfwGenerationResponse,
    context: HiggsfieldWebhookContext,
  ) => void | Promise<void>
  cancelled?: (
    event: CancelledGenerationResponse,
    context: HiggsfieldWebhookContext,
  ) => void | Promise<void>
}

export interface CreateWebhookHandlerOptions extends ParseWebhookOptions {
  onEvent?: (
    event: TerminalGenerationResponse,
    context: HiggsfieldWebhookContext,
  ) => void | Promise<void>
  handlers?: HiggsfieldWebhookEventHandlers
  idempotency?: WebhookIdempotencyStore
  onError?: (
    error: unknown,
    request: HiggsfieldWebhookRequest,
  ) => void | Promise<void>
  successStatusCode?: number
  maxBodyBytes?: number
}

export interface WebhookHandlerResult {
  statusCode: number
  headers: Record<string, string>
  body: string
  event?: TerminalGenerationResponse
  duplicate?: boolean
}

export interface NodeIncomingMessageLike extends AsyncIterable<unknown> {
  method?: string
  headers?: WebhookHeaders
}

export interface NodeServerResponseLike {
  statusCode: number
  setHeader(name: string, value: string): unknown
  end(body?: string): unknown
}

export class MemoryWebhookIdempotencyStore implements WebhookIdempotencyStore {
  private readonly requestIds = new Set<string>()

  public acquire(requestId: string): boolean {
    if (this.requestIds.has(requestId)) {
      return false
    }

    this.requestIds.add(requestId)
    return true
  }

  public release(requestId: string): void {
    this.requestIds.delete(requestId)
  }

  public has(requestId: string): boolean {
    return this.requestIds.has(requestId)
  }

  public clear(): void {
    this.requestIds.clear()
  }
}

export class HiggsfieldWebhookHandler {
  private readonly successStatusCode: number
  private readonly maxBodyBytes: number

  public constructor(private readonly options: CreateWebhookHandlerOptions = {}) {
    this.successStatusCode = options.successStatusCode ?? 200
    this.maxBodyBytes = options.maxBodyBytes ?? 1_048_576

    if (
      !Number.isInteger(this.successStatusCode) ||
      this.successStatusCode < 200 ||
      this.successStatusCode > 299
    ) {
      throw new HiggsfieldValidationError(
        'successStatusCode must be an HTTP 2xx status code.',
        'successStatusCode',
      )
    }

    if (!Number.isInteger(this.maxBodyBytes) || this.maxBodyBytes <= 0) {
      throw new HiggsfieldValidationError(
        'maxBodyBytes must be a positive integer.',
        'maxBodyBytes',
      )
    }
  }

  /** Framework-neutral handler for Express, Fastify, AdonisJS, Hono, workers, and tests. */
  public async handle(request: HiggsfieldWebhookRequest): Promise<WebhookHandlerResult> {
    if ((request.method ?? 'POST').toUpperCase() !== 'POST') {
      return jsonResult(405, { error: 'Method not allowed.' }, { allow: 'POST' })
    }

    try {
      assertBodySize(request.body, this.maxBodyBytes)
      const headers = request.headers ?? {}
      const event = await parseWebhook(request.body, {
        headers,
        ...(this.options.verify !== undefined ? { verify: this.options.verify } : {}),
      })
      const context: HiggsfieldWebhookContext = {
        headers,
        receivedAt: new Date(),
        ...(isRawBody(request.body) ? { rawBody: request.body } : {}),
      }

      if (this.options.idempotency !== undefined) {
        const acquired = await this.options.idempotency.acquire(event.request_id, event)
        if (!acquired) {
          return {
            ...jsonResult(this.successStatusCode, {
              received: true,
              duplicate: true,
              request_id: event.request_id,
            }),
            event,
            duplicate: true,
          }
        }
      }

      try {
        await this.dispatch(event, context)
      } catch (error) {
        await this.options.idempotency?.release?.(event.request_id, event)
        throw error
      }

      return {
        ...jsonResult(this.successStatusCode, {
          received: true,
          request_id: event.request_id,
          status: event.status,
        }),
        event,
        duplicate: false,
      }
    } catch (error) {
      await this.options.onError?.(error, request)

      if (error instanceof HiggsfieldWebhookVerificationError) {
        return jsonResult(401, { error: 'Webhook verification failed.' })
      }

      if (error instanceof HiggsfieldWebhookBodyTooLargeError) {
        return jsonResult(413, { error: error.message })
      }

      if (error instanceof HiggsfieldValidationError) {
        return jsonResult(400, { error: error.message })
      }

      return jsonResult(500, { error: 'Webhook processing failed.' })
    }
  }

  /** Dependency-free Node.js HTTP adapter. */
  public async handleNode(
    request: NodeIncomingMessageLike,
    response: NodeServerResponseLike,
  ): Promise<void> {
    let result: WebhookHandlerResult

    try {
      const body = await readNodeBody(request, this.maxBodyBytes)
      result = await this.handle({
        ...(request.method !== undefined ? { method: request.method } : {}),
        body,
        headers: request.headers ?? {},
      })
    } catch (error) {
      await this.options.onError?.(error, {
        ...(request.method !== undefined ? { method: request.method } : {}),
        body: '',
        headers: request.headers ?? {},
      })

      result =
        error instanceof HiggsfieldWebhookBodyTooLargeError
          ? jsonResult(413, { error: error.message })
          : jsonResult(400, { error: 'Unable to read webhook request body.' })
    }

    response.statusCode = result.statusCode
    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value)
    }
    response.end(result.body)
  }

  private async dispatch(
    event: TerminalGenerationResponse,
    context: HiggsfieldWebhookContext,
  ): Promise<void> {
    await this.options.onEvent?.(event, context)

    if (event.status === 'completed') {
      await this.options.handlers?.completed?.(event, context)
      return
    }

    if (event.status === 'failed') {
      await this.options.handlers?.failed?.(event, context)
      return
    }

    if (event.status === 'nsfw') {
      await this.options.handlers?.nsfw?.(event, context)
      return
    }

    await this.options.handlers?.cancelled?.(event, context)
  }
}

export function createWebhookHandler(
  options: CreateWebhookHandlerOptions = {},
): HiggsfieldWebhookHandler {
  return new HiggsfieldWebhookHandler(options)
}

export async function handleWebhook(
  request: HiggsfieldWebhookRequest,
  options: CreateWebhookHandlerOptions = {},
): Promise<WebhookHandlerResult> {
  return createWebhookHandler(options).handle(request)
}

export async function parseWebhook(
  body: string | Uint8Array | unknown,
  options: ParseWebhookOptions = {},
): Promise<TerminalGenerationResponse> {
  if (options.verify !== undefined) {
    if (!isRawBody(body)) {
      throw new HiggsfieldWebhookVerificationError(
        'Webhook verification requires the original raw string or Uint8Array body.',
      )
    }

    const verified = await options.verify({
      body,
      headers: options.headers ?? {},
    })

    if (!verified) {
      throw new HiggsfieldWebhookVerificationError('Webhook verification failed.')
    }
  }

  const payload = parseBody(body)
  const response = parseGenerationResponse(payload)

  if (!isTerminalResponse(response)) {
    throw new HiggsfieldValidationError(
      `Webhook payload must contain a terminal status; received "${response.status}".`,
      'status',
    )
  }

  return response
}

function parseBody(body: string | Uint8Array | unknown): unknown {
  if (typeof body === 'string') {
    return parseJson(body)
  }

  if (body instanceof Uint8Array) {
    return parseJson(new TextDecoder().decode(body))
  }

  return body
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value) as unknown
  } catch (error) {
    throw new HiggsfieldValidationError('Webhook body is not valid JSON.', undefined, {
      cause: error,
    })
  }
}

function isRawBody(body: unknown): body is string | Uint8Array {
  return typeof body === 'string' || body instanceof Uint8Array
}

function assertBodySize(body: unknown, maxBodyBytes: number): void {
  if (!isRawBody(body)) {
    return
  }

  const length =
    typeof body === 'string' ? new TextEncoder().encode(body).byteLength : body.byteLength

  if (length > maxBodyBytes) {
    throw new HiggsfieldWebhookBodyTooLargeError(
      `Webhook body exceeds the ${maxBodyBytes}-byte limit.`,
      maxBodyBytes,
    )
  }
}

async function readNodeBody(
  request: NodeIncomingMessageLike,
  maxBodyBytes: number,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = []
  let total = 0

  for await (const chunk of request) {
    const bytes = normalizeChunk(chunk)
    total += bytes.byteLength

    if (total > maxBodyBytes) {
      throw new HiggsfieldWebhookBodyTooLargeError(
        `Webhook body exceeds the ${maxBodyBytes}-byte limit.`,
        maxBodyBytes,
      )
    }

    chunks.push(bytes)
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return body
}

function normalizeChunk(chunk: unknown): Uint8Array {
  if (typeof chunk === 'string') {
    return new TextEncoder().encode(chunk)
  }

  if (chunk instanceof Uint8Array) {
    return chunk
  }

  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk)
  }

  throw new HiggsfieldValidationError('Webhook request contained an unsupported body chunk.')
}

function jsonResult(
  statusCode: number,
  payload: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
): WebhookHandlerResult {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
    body: JSON.stringify(payload),
  }
}
