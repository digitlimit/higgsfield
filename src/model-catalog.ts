/**
 * Canonical Higgsfield model IDs exposed by the current Higgsfield Cloud gallery
 * and covered by the strongly typed SDK surface.
 *
 * Arbitrary future model IDs remain supported through the `ModelId` string union.
 */
export const HIGGSFIELD_MODELS = {
  SOUL_STANDARD: 'higgsfield-ai/soul/standard',
  SOUL_2: 'higgsfield-ai/soul/2',
  SOUL_CHARACTER: 'higgsfield-ai/soul/character',
  SOUL_CINEMA: 'higgsfield-ai/soul/cinema',
  SOUL_REFERENCE: 'higgsfield-ai/soul/reference',
  SOUL_ID: 'higgsfield-ai/soul/id',
  POPCORN_AUTO: 'higgsfield-ai/popcorn/auto',
  DOP_LITE: 'higgsfield-ai/dop/lite',
  DOP_LITE_FIRST_LAST_FRAME: 'higgsfield-ai/dop/lite/first-last-frame',
  DOP_STANDARD: 'higgsfield-ai/dop/standard',
  DOP_STANDARD_FIRST_LAST_FRAME: 'higgsfield-ai/dop/standard/first-last-frame',
  DOP_TURBO: 'higgsfield-ai/dop/turbo',
  DOP_TURBO_FIRST_LAST_FRAME: 'higgsfield-ai/dop/turbo/first-last-frame',
  QWEN_AUDIO_3_TTS_FLASH: 'qwen/qwen-audio-3.0-tts-flash',
} as const

export type KnownCanonicalModelId =
  (typeof HIGGSFIELD_MODELS)[keyof typeof HIGGSFIELD_MODELS]

export const HIGGSFIELD_MODEL_ALIASES = {
  'higgsfield/soul-standard': HIGGSFIELD_MODELS.SOUL_STANDARD,
  'higgsfield/soul-2': HIGGSFIELD_MODELS.SOUL_2,
  'higgsfield/soul-character': HIGGSFIELD_MODELS.SOUL_CHARACTER,
  'higgsfield/soul-cinema': HIGGSFIELD_MODELS.SOUL_CINEMA,
  'higgsfield/soul-reference': HIGGSFIELD_MODELS.SOUL_REFERENCE,
  'higgsfield/soul-id': HIGGSFIELD_MODELS.SOUL_ID,
  'higgsfield/popcorn-auto': HIGGSFIELD_MODELS.POPCORN_AUTO,
  'higgsfield/dop-lite': HIGGSFIELD_MODELS.DOP_LITE,
  'higgsfield/dop-lite-first-last-frame': HIGGSFIELD_MODELS.DOP_LITE_FIRST_LAST_FRAME,
  'higgsfield/dop-standard': HIGGSFIELD_MODELS.DOP_STANDARD,
  'higgsfield/dop-standard-first-last-frame':
    HIGGSFIELD_MODELS.DOP_STANDARD_FIRST_LAST_FRAME,
  'higgsfield/dop-turbo': HIGGSFIELD_MODELS.DOP_TURBO,
  'higgsfield/dop-turbo-first-last-frame':
    HIGGSFIELD_MODELS.DOP_TURBO_FIRST_LAST_FRAME,
  'qwen/audio-3.0-tts-flash': HIGGSFIELD_MODELS.QWEN_AUDIO_3_TTS_FLASH,
} as const satisfies Readonly<Record<string, KnownCanonicalModelId>>

export type KnownModelAlias = keyof typeof HIGGSFIELD_MODEL_ALIASES

export const HIGGSFIELD_IMAGE_MODELS = [
  HIGGSFIELD_MODELS.SOUL_STANDARD,
  HIGGSFIELD_MODELS.SOUL_2,
  HIGGSFIELD_MODELS.SOUL_CHARACTER,
  HIGGSFIELD_MODELS.SOUL_CINEMA,
  HIGGSFIELD_MODELS.SOUL_REFERENCE,
  HIGGSFIELD_MODELS.POPCORN_AUTO,
] as const

export const HIGGSFIELD_VIDEO_MODELS = [
  HIGGSFIELD_MODELS.DOP_LITE,
  HIGGSFIELD_MODELS.DOP_LITE_FIRST_LAST_FRAME,
  HIGGSFIELD_MODELS.DOP_STANDARD,
  HIGGSFIELD_MODELS.DOP_STANDARD_FIRST_LAST_FRAME,
  HIGGSFIELD_MODELS.DOP_TURBO,
  HIGGSFIELD_MODELS.DOP_TURBO_FIRST_LAST_FRAME,
] as const

export const HIGGSFIELD_AUDIO_MODELS = [
  HIGGSFIELD_MODELS.QWEN_AUDIO_3_TTS_FLASH,
] as const
