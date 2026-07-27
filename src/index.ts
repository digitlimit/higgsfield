import { createHiggsfield, HiggsfieldClient } from './client.js'
import type { HiggsfieldClientOptions } from './config.js'
import type {
  CompletedGenerationResponse,
  GenerateOptions,
  GenerationResponse,
  ModelId,
  PollOptions,
  RequestOptions,
  SubmitGenerationOptions,
  TerminalGenerationResponse,
} from './types.js'

export { createHiggsfield, HiggsfieldClient }
export type {
  AuthMode,
  HiggsfieldClientOptions,
  HiggsfieldLogger,
  RetryOptions,
} from './config.js'
export {
  HiggsfieldAbortError,
  HiggsfieldApiError,
  HiggsfieldConfigurationError,
  HiggsfieldError,
  HiggsfieldGenerationError,
  HiggsfieldNetworkError,
  HiggsfieldTimeoutError,
  HiggsfieldValidationError,
  HiggsfieldWebhookBodyTooLargeError,
  HiggsfieldWebhookVerificationError,
} from './errors.js'
export {
  HIGGSFIELD_AUDIO_MODELS,
  HIGGSFIELD_IMAGE_MODELS,
  HIGGSFIELD_MODEL_ALIASES,
  HIGGSFIELD_MODELS,
  HIGGSFIELD_VIDEO_MODELS,
} from './model-catalog.js'
export { resolveModelId } from './models.js'
export { GenerationRequestController } from './request-controller.js'
export { isCompletedResponse, isTerminalResponse } from './responses.js'
export {
  createWebhookHandler,
  handleWebhook,
  HiggsfieldWebhookHandler,
  MemoryWebhookIdempotencyStore,
  parseWebhook,
} from './webhooks.js'
export type {
  CreateWebhookHandlerOptions,
  HiggsfieldWebhookContext,
  HiggsfieldWebhookEventHandlers,
  HiggsfieldWebhookRequest,
  NodeIncomingMessageLike,
  NodeServerResponseLike,
  ParseWebhookOptions,
  WebhookHandlerResult,
  WebhookHeaders,
  WebhookIdempotencyStore,
  WebhookVerificationContext,
} from './webhooks.js'
export type {
  AspectRatio,
  BaseGenerationResponse,
  CancelledGenerationResponse,
  CanonicalModelFor,
  CompletedGenerationResponse,
  DoPFirstLastFrameInput,
  DoPInput,
  DoPMotion,
  FailedGenerationResponse,
  GenerateOptions,
  GenerationResponse,
  GenerationStatus,
  ImageBatchSize,
  ImageResolution,
  InProgressGenerationResponse,
  InputForModel,
  KnownCanonicalModelId,
  KnownModelAlias,
  LiteralUnion,
  MediaFile,
  ModelId,
  ModelInputMap,
  Motion,
  NsfwGenerationResponse,
  PollOptions,
  PopcornAutoInput,
  PopcornResolution,
  QueuedGenerationResponse,
  QwenAudio3TtsFlashInput,
  RawRequestOptions,
  RequestOptions,
  Seed,
  Soul2Input,
  SoulCharacterInput,
  SoulCinemaInput,
  SoulIdInput,
  SoulImageBaseInput,
  SoulReferenceInput,
  SoulResolution,
  SoulStandardInput,
  SoulStyle,
  SubmitGenerationOptions,
  SubscribeGenerationOptions,
  TerminalGenerationResponse,
  UnknownRecord,
} from './types.js'

let defaultClient: HiggsfieldClient | undefined

export function configureHiggsfield(options: HiggsfieldClientOptions): HiggsfieldClient {
  defaultClient = createHiggsfield(options)
  return defaultClient
}

export function setDefaultHiggsfieldClient(client: HiggsfieldClient): void {
  defaultClient = client
}

export function getDefaultHiggsfieldClient(): HiggsfieldClient {
  defaultClient ??= createHiggsfield()
  return defaultClient
}

export async function submit<M extends ModelId>(options: SubmitGenerationOptions<M>) {
  return getDefaultHiggsfieldClient().submit(options)
}

export async function generate<M extends ModelId>(
  options: GenerateOptions<M>,
): Promise<CompletedGenerationResponse> {
  return getDefaultHiggsfieldClient().generate(options)
}

export async function subscribe<M extends ModelId>(
  options: GenerateOptions<M>,
): Promise<CompletedGenerationResponse> {
  return getDefaultHiggsfieldClient().subscribe(options)
}

export async function getStatus(
  requestId: string,
  options: RequestOptions = {},
): Promise<GenerationResponse> {
  return getDefaultHiggsfieldClient().getStatus(requestId, options)
}

export const status = getStatus

export function poll(
  requestId: string,
  options: PollOptions = {},
): AsyncGenerator<GenerationResponse, void, void> {
  return getDefaultHiggsfieldClient().poll(requestId, options)
}

export async function wait(
  requestId: string,
  options: PollOptions = {},
): Promise<TerminalGenerationResponse> {
  return getDefaultHiggsfieldClient().wait(requestId, options)
}

export async function getResult(
  requestId: string,
  options: PollOptions = {},
): Promise<CompletedGenerationResponse> {
  return getDefaultHiggsfieldClient().getResult(requestId, options)
}

export async function cancel(
  requestId: string,
  options: RequestOptions = {},
): Promise<void> {
  return getDefaultHiggsfieldClient().cancel(requestId, options)
}

export const generateText = generate
export const generateImage = generate
export const generateVideo = generate
export const generateAudio = generate
