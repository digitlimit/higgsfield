import {
  resolveConfig,
  type HiggsfieldClientOptions,
  type ResolvedHiggsfieldConfig,
} from './config.js'
import { HiggsfieldValidationError } from './errors.js'
import { resolveModelId, validateModelInput } from './models.js'
import {
  GenerationRequestController,
  type GenerationOperations,
} from './request-controller.js'
import { parseGenerationResponse } from './responses.js'
import { FetchTransport, type HttpTransport } from './transport.js'
import type {
  CompletedGenerationResponse,
  GenerateOptions,
  GenerationResponse,
  ModelId,
  Motion,
  PollOptions,
  RawRequestOptions,
  RequestOptions,
  SoulStyle,
  SubmitGenerationOptions,
  TerminalGenerationResponse,
  UnknownRecord,
} from './types.js'

interface ClientDependencies {
  transport?: HttpTransport
}

export class HiggsfieldClient implements GenerationOperations {
  private readonly config: ResolvedHiggsfieldConfig
  private readonly transport: HttpTransport

  public constructor(options: HiggsfieldClientOptions = {}, dependencies: ClientDependencies = {}) {
    this.config = resolveConfig(options)
    this.transport = dependencies.transport ?? new FetchTransport(this.config)
  }

  public async submit<M extends ModelId>(
    options: SubmitGenerationOptions<M>,
  ): Promise<GenerationRequestController> {
    const { model, webhookUrl, signal, requestTimeoutMs, headers, onEnqueue, ...input } =
      options as SubmitGenerationOptions<ModelId>

    const modelId = resolveModelId(model)
    const body = input as UnknownRecord

    if (this.config.validateRequests) {
      validateModelInput(modelId, body)
    }

    const resolvedWebhookUrl =
      webhookUrl === false ? undefined : webhookUrl ?? this.config.callbackUrl
    const query =
      resolvedWebhookUrl === undefined ? undefined : { hf_webhook: resolvedWebhookUrl }

    const payload = await this.transport.request<unknown>({
      method: 'POST',
      path: modelId,
      ...(query !== undefined ? { query } : {}),
      body,
      ...(headers !== undefined ? { headers } : {}),
      ...(signal !== undefined ? { signal } : {}),
      ...(requestTimeoutMs !== undefined ? { timeoutMs: requestTimeoutMs } : {}),
    })

    const response = parseGenerationResponse(payload)
    await onEnqueue?.(response.request_id)

    return new GenerationRequestController(response.request_id, this, this.config, response)
  }

  /** Submit a generation and wait until it completes successfully. */
  public async generate<M extends ModelId>(
    options: GenerateOptions<M>,
  ): Promise<CompletedGenerationResponse> {
    const { polling, ...submitOptions } = options
    const controller = await this.submit(submitOptions as SubmitGenerationOptions<M>)
    return controller.get(polling)
  }

  /** Alias matching asynchronous SDK terminology used by Higgsfield's official clients. */
  public async subscribe<M extends ModelId>(
    options: GenerateOptions<M>,
  ): Promise<CompletedGenerationResponse> {
    return this.generate(options)
  }

  public controller(requestId: string): GenerationRequestController {
    assertRequestId(requestId)
    return new GenerationRequestController(requestId, this, this.config)
  }

  public async getStatus(
    requestId: string,
    options: RequestOptions = {},
  ): Promise<GenerationResponse> {
    assertRequestId(requestId)
    const payload = await this.transport.request<unknown>({
      method: 'GET',
      path: `requests/${encodeURIComponent(requestId)}/status`,
      ...(options.headers !== undefined ? { headers: options.headers } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.requestTimeoutMs !== undefined
        ? { timeoutMs: options.requestTimeoutMs }
        : {}),
    })

    return parseGenerationResponse(payload)
  }

  public async status(
    requestId: string,
    options: RequestOptions = {},
  ): Promise<GenerationResponse> {
    return this.getStatus(requestId, options)
  }

  public poll(
    requestId: string,
    options: PollOptions = {},
  ): AsyncGenerator<GenerationResponse, void, void> {
    return this.controller(requestId).poll(options)
  }

  public async wait(
    requestId: string,
    options: PollOptions = {},
  ): Promise<TerminalGenerationResponse> {
    return this.controller(requestId).wait(options)
  }

  public async getResult(
    requestId: string,
    options: PollOptions = {},
  ): Promise<CompletedGenerationResponse> {
    return this.controller(requestId).get(options)
  }

  public async cancel(
    requestId: string,
    options: RequestOptions = {},
  ): Promise<void> {
    assertRequestId(requestId)
    await this.transport.request<void>({
      method: 'POST',
      path: `requests/${encodeURIComponent(requestId)}/cancel`,
      ...(options.headers !== undefined ? { headers: options.headers } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.requestTimeoutMs !== undefined
        ? { timeoutMs: options.requestTimeoutMs }
        : {}),
    })
  }

  public async listMotions(options: RequestOptions = {}): Promise<Motion[]> {
    const payload = await this.transport.request<unknown>({
      method: 'GET',
      path: 'v1/motions',
      ...(options.headers !== undefined ? { headers: options.headers } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.requestTimeoutMs !== undefined
        ? { timeoutMs: options.requestTimeoutMs }
        : {}),
    })

    if (!Array.isArray(payload)) {
      throw new HiggsfieldValidationError('Higgsfield motions response must be an array.')
    }

    return payload as Motion[]
  }

  public async listSoulStyles(options: RequestOptions = {}): Promise<SoulStyle[]> {
    const payload = await this.transport.request<unknown>({
      method: 'GET',
      path: 'v1/text2image/soul-styles',
      ...(options.headers !== undefined ? { headers: options.headers } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.requestTimeoutMs !== undefined
        ? { timeoutMs: options.requestTimeoutMs }
        : {}),
    })

    if (!Array.isArray(payload)) {
      throw new HiggsfieldValidationError('Higgsfield Soul styles response must be an array.')
    }

    return payload as SoulStyle[]
  }

  public async rawRequest<T>(options: RawRequestOptions): Promise<T> {
    return this.transport.request<T>({
      method: options.method ?? 'GET',
      path: options.path,
      ...(options.query !== undefined ? { query: options.query } : {}),
      ...(options.body !== undefined ? { body: options.body } : {}),
      ...(options.headers !== undefined ? { headers: options.headers } : {}),
      ...(options.signal !== undefined ? { signal: options.signal } : {}),
      ...(options.requestTimeoutMs !== undefined
        ? { timeoutMs: options.requestTimeoutMs }
        : {}),
    })
  }
}

export function createHiggsfield(options: HiggsfieldClientOptions = {}): HiggsfieldClient {
  return new HiggsfieldClient(options)
}

function assertRequestId(requestId: string): void {
  if (typeof requestId !== 'string' || requestId.trim() === '') {
    throw new HiggsfieldValidationError('requestId must be a non-empty string.', 'requestId')
  }
}
