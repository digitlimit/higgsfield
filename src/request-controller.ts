import type { ResolvedHiggsfieldConfig } from './config.js'
import {
  HiggsfieldGenerationError,
  HiggsfieldTimeoutError,
  HiggsfieldValidationError,
} from './errors.js'
import { jitter, sleep } from './internal/runtime.js'
import { isCompletedResponse, isTerminalResponse } from './responses.js'
import type {
  CompletedGenerationResponse,
  GenerationResponse,
  PollOptions,
  TerminalGenerationResponse,
} from './types.js'

export interface GenerationOperations {
  getStatus(requestId: string, options?: { signal?: AbortSignal }): Promise<GenerationResponse>
  cancel(requestId: string, options?: { signal?: AbortSignal }): Promise<void>
}

export class GenerationRequestController {
  public constructor(
    public readonly requestId: string,
    private readonly operations: GenerationOperations,
    private readonly config: ResolvedHiggsfieldConfig,
    private readonly initialResponse?: GenerationResponse,
  ) {
    if (requestId.trim() === '') {
      throw new HiggsfieldValidationError('requestId must be a non-empty string.', 'requestId')
    }

    if (
      initialResponse !== undefined &&
      initialResponse.request_id !== requestId
    ) {
      throw new HiggsfieldValidationError(
        'The initial response request_id does not match the controller requestId.',
        'request_id',
      )
    }
  }

  public async status(options?: { signal?: AbortSignal }): Promise<GenerationResponse> {
    return this.operations.getStatus(this.requestId, options)
  }

  public async cancel(options?: { signal?: AbortSignal }): Promise<void> {
    await this.operations.cancel(this.requestId, options)
  }

  public async *poll(options: PollOptions = {}): AsyncGenerator<GenerationResponse, void, void> {
    const resolved = {
      ...this.config.polling,
      ...options,
    }

    const startedAt = Date.now()
    let statusChecks = 0
    let delayMs = resolved.intervalMs
    let response = this.initialResponse
    let previousStatus: string | undefined

    while (true) {
      if (response === undefined) {
        response = await this.operations.getStatus(this.requestId, {
          ...(resolved.signal !== undefined ? { signal: resolved.signal } : {}),
        })
        statusChecks += 1
      }

      const changed = response.status !== previousStatus
      if (changed || resolved.emitUnchangedStatus) {
        await resolved.onStatus?.(response)
        yield response
      }
      previousStatus = response.status

      if (isTerminalResponse(response)) {
        return
      }

      if (statusChecks >= resolved.maxAttempts) {
        throw new HiggsfieldTimeoutError(
          `Generation ${this.requestId} did not finish within ${resolved.maxAttempts} status checks.`,
          Date.now() - startedAt,
          response,
        )
      }

      const elapsed = Date.now() - startedAt
      if (elapsed >= resolved.timeoutMs) {
        throw new HiggsfieldTimeoutError(
          `Generation ${this.requestId} did not finish within ${resolved.timeoutMs}ms.`,
          resolved.timeoutMs,
          response,
        )
      }

      const remaining = resolved.timeoutMs - elapsed
      await sleep(Math.min(jitter(delayMs, resolved.jitterRatio), remaining), resolved.signal)

      response = await this.operations.getStatus(this.requestId, {
        ...(resolved.signal !== undefined ? { signal: resolved.signal } : {}),
      })
      statusChecks += 1
      delayMs = Math.min(delayMs * resolved.backoffFactor, resolved.maxIntervalMs)
    }
  }

  public async wait(options: PollOptions = {}): Promise<TerminalGenerationResponse> {
    let last: GenerationResponse | undefined

    for await (const response of this.poll(options)) {
      last = response
    }

    if (last === undefined || !isTerminalResponse(last)) {
      throw new HiggsfieldValidationError('Polling ended without a terminal response.')
    }

    return last
  }

  public async get(options: PollOptions = {}): Promise<CompletedGenerationResponse> {
    const response = await this.wait(options)

    if (isCompletedResponse(response)) {
      return response
    }

    const detail =
      response.status === 'failed' && typeof response.error === 'string'
        ? `: ${response.error}`
        : ''

    throw new HiggsfieldGenerationError(
      `Generation ${this.requestId} ended with status "${response.status}"${detail}`,
      response,
    )
  }
}
