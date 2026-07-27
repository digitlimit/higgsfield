import type {
  HIGGSFIELD_MODEL_ALIASES,
  KnownCanonicalModelId,
  KnownModelAlias,
} from './model-catalog.js'

export type UnknownRecord = Record<string, unknown>

export type LiteralUnion<T extends U, U = string> = T | (U & Record<never, never>)

export type { KnownCanonicalModelId, KnownModelAlias }

export type ModelId = LiteralUnion<KnownCanonicalModelId | KnownModelAlias>

export type AspectRatio =
  | '9:16'
  | '16:9'
  | '21:9'
  | '5:4'
  | '4:5'
  | '4:3'
  | '3:4'
  | '1:1'
  | '2:3'
  | '3:2'

export type SoulResolution = '720p' | '1080p' | '2K' | '4K'
export type PopcornResolution = '720p' | '1600p'
export type ImageResolution = SoulResolution | PopcornResolution
export type ImageBatchSize = 1 | 2 | 3 | 4
export type Seed = number | null

export interface SoulImageBaseInput extends UnknownRecord {
  prompt: string
  aspect_ratio?: AspectRatio
  batch_size?: ImageBatchSize
  enhance_prompt?: boolean
  resolution?: SoulResolution
  seed?: Seed
  style_id?: string | null
  style_strength?: number
  camera_fixed?: boolean
}

export interface SoulStandardInput extends SoulImageBaseInput {
  batch_size?: 1 | 4
}

export interface Soul2Input extends SoulImageBaseInput {
  image_reference_url?: string
  custom_reference_id?: string
  custom_reference_strength?: number
}

export interface SoulCinemaInput extends SoulImageBaseInput {
  image_reference_url?: string
  custom_reference_id?: string
  custom_reference_strength?: number
  hex_colors?: string[]
}

export interface SoulReferenceInput extends SoulImageBaseInput {
  image_reference_url: string
}

export interface SoulCharacterInput extends SoulImageBaseInput {
  custom_reference_id: string
  custom_reference_strength: number
  image_reference_url?: string
  batch_size?: 1 | 4
}

/**
 * Soul ID is a character-training endpoint. Higgsfield may add fields over time,
 * therefore the SDK keeps the request extensible while typing the common fields.
 */
export interface SoulIdInput extends UnknownRecord {
  name?: string
  prompt?: string
  image_urls?: string[]
  reference_image_urls?: string[]
  callback_url?: string
}

export interface PopcornAutoInput extends UnknownRecord {
  prompt: string
  seed?: Seed
  image_urls?: string[]
  num_images?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
  resolution?: PopcornResolution
  aspect_ratio?: AspectRatio
}

export interface DoPMotion {
  id: string
  strength?: number
}

export interface DoPInput extends UnknownRecord {
  image_url: string
  prompt: string
  enhance_prompt?: boolean
  motions?: Array<string | DoPMotion>
  seed?: Seed
  duration?: number
  check_nsfw?: boolean
}

export interface DoPFirstLastFrameInput extends DoPInput {
  last_frame_url?: string
  image_url_end?: string
  end_image_url?: string
  input_images_end?: Array<{
    type: 'image_url'
    image_url: string
  }>
}

/**
 * Typed common request shape for Qwen Audio 3.0 TTS Flash. Additional provider
 * fields are accepted to remain forward compatible with the Higgsfield model page.
 */
export interface QwenAudio3TtsFlashInput extends UnknownRecord {
  text: string
  voice?: string
  language?: string
  instructions?: string
  format?: LiteralUnion<'mp3' | 'wav' | 'pcm'>
  speed?: number
  seed?: Seed
}

export interface ModelInputMap {
  'higgsfield-ai/soul/standard': SoulStandardInput
  'higgsfield-ai/soul/2': Soul2Input
  'higgsfield-ai/soul/character': SoulCharacterInput
  'higgsfield-ai/soul/cinema': SoulCinemaInput
  'higgsfield-ai/soul/reference': SoulReferenceInput
  'higgsfield-ai/soul/id': SoulIdInput
  'higgsfield-ai/popcorn/auto': PopcornAutoInput
  'higgsfield-ai/dop/lite': DoPInput
  'higgsfield-ai/dop/lite/first-last-frame': DoPFirstLastFrameInput
  'higgsfield-ai/dop/standard': DoPInput
  'higgsfield-ai/dop/standard/first-last-frame': DoPFirstLastFrameInput
  'higgsfield-ai/dop/turbo': DoPInput
  'higgsfield-ai/dop/turbo/first-last-frame': DoPFirstLastFrameInput
  'qwen/qwen-audio-3.0-tts-flash': QwenAudio3TtsFlashInput
}

type AliasMap = typeof HIGGSFIELD_MODEL_ALIASES

export type CanonicalModelFor<M extends ModelId> = M extends keyof AliasMap
  ? AliasMap[M]
  : M

export type InputForModel<M extends ModelId> = CanonicalModelFor<M> extends keyof ModelInputMap
  ? ModelInputMap[CanonicalModelFor<M>]
  : UnknownRecord

export type GenerationStatus =
  | 'queued'
  | 'in_progress'
  | 'nsfw'
  | 'failed'
  | 'completed'
  | 'cancelled'
  | 'canceled'

export interface MediaFile extends UnknownRecord {
  url: string
  content_type?: string
  width?: number
  height?: number
  duration?: number
}

export interface BaseGenerationResponse extends UnknownRecord {
  status: GenerationStatus
  request_id: string
  status_url?: string
  cancel_url?: string
}

export interface QueuedGenerationResponse extends BaseGenerationResponse {
  status: 'queued'
}

export interface InProgressGenerationResponse extends BaseGenerationResponse {
  status: 'in_progress'
}

export interface CompletedGenerationResponse extends BaseGenerationResponse {
  status: 'completed'
  images?: MediaFile[]
  video?: MediaFile
  audio?: MediaFile
  audios?: MediaFile[]
}

export interface FailedGenerationResponse extends BaseGenerationResponse {
  status: 'failed'
  error?: string | UnknownRecord
}

export interface NsfwGenerationResponse extends BaseGenerationResponse {
  status: 'nsfw'
  error?: string | UnknownRecord
}

export interface CancelledGenerationResponse extends BaseGenerationResponse {
  status: 'cancelled' | 'canceled'
}

export type TerminalGenerationResponse =
  | CompletedGenerationResponse
  | FailedGenerationResponse
  | NsfwGenerationResponse
  | CancelledGenerationResponse

export type GenerationResponse =
  | QueuedGenerationResponse
  | InProgressGenerationResponse
  | TerminalGenerationResponse

export interface RequestOptions {
  signal?: AbortSignal
  requestTimeoutMs?: number
  headers?: HeadersInit
}

export interface PollOptions {
  intervalMs?: number
  maxIntervalMs?: number
  backoffFactor?: number
  jitterRatio?: number
  timeoutMs?: number
  maxAttempts?: number
  signal?: AbortSignal
  emitUnchangedStatus?: boolean
  onStatus?: (response: GenerationResponse) => void | Promise<void>
}

export type SubmitGenerationOptions<M extends ModelId = ModelId> = {
  model: M
  /** Use `false` to disable the callback configured by HIGGSFIELD_CALLBACK. */
  webhookUrl?: string | false
  onEnqueue?: (requestId: string) => void | Promise<void>
} & RequestOptions &
  InputForModel<M>

export type GenerateOptions<M extends ModelId = ModelId> = SubmitGenerationOptions<M> & {
  polling?: PollOptions
}

export type SubscribeGenerationOptions<M extends ModelId = ModelId> = GenerateOptions<M>

export interface Motion extends UnknownRecord {
  id: string
  name?: string
  description?: string | null
  preview_url?: string
}

export interface SoulStyle extends UnknownRecord {
  id: string
  name: string
  description?: string | null
  preview_url: string
}

export interface RawRequestOptions extends RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
}
