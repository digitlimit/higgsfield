import { HiggsfieldValidationError } from './errors.js'
import {
  HIGGSFIELD_MODEL_ALIASES,
  HIGGSFIELD_MODELS,
  type KnownModelAlias,
} from './model-catalog.js'
import type {
  DoPFirstLastFrameInput,
  DoPInput,
  ModelId,
  PopcornAutoInput,
  QwenAudio3TtsFlashInput,
  SoulCharacterInput,
  SoulImageBaseInput,
  SoulReferenceInput,
  SoulStandardInput,
  UnknownRecord,
} from './types.js'

const DOP_MODELS = new Set<string>([
  HIGGSFIELD_MODELS.DOP_LITE,
  HIGGSFIELD_MODELS.DOP_STANDARD,
  HIGGSFIELD_MODELS.DOP_TURBO,
])

const DOP_FIRST_LAST_FRAME_MODELS = new Set<string>([
  HIGGSFIELD_MODELS.DOP_LITE_FIRST_LAST_FRAME,
  HIGGSFIELD_MODELS.DOP_STANDARD_FIRST_LAST_FRAME,
  HIGGSFIELD_MODELS.DOP_TURBO_FIRST_LAST_FRAME,
])

const SOUL_GENERIC_MODELS = new Set<string>([
  HIGGSFIELD_MODELS.SOUL_2,
  HIGGSFIELD_MODELS.SOUL_CINEMA,
])

export { HIGGSFIELD_MODEL_ALIASES, HIGGSFIELD_MODELS }

export function resolveModelId(model: ModelId): string {
  const value = String(model).trim()
  assertSafeModelPath(value)

  const known = HIGGSFIELD_MODEL_ALIASES[value as KnownModelAlias]
  if (known !== undefined) {
    return known
  }

  if (value.startsWith('higgsfield/')) {
    const aliasPath = value.slice('higgsfield/'.length)
    const segments = aliasPath.split('--').filter(Boolean)
    if (segments.length < 2) {
      throw new HiggsfieldValidationError(
        'Higgsfield aliases must use the form "higgsfield/family--variant".',
        'model',
      )
    }

    const resolved = `higgsfield-ai/${segments.join('/')}`
    assertSafeModelPath(resolved)
    return resolved
  }

  return value
}

export function validateModelInput(model: string, input: UnknownRecord): void {
  if (model === HIGGSFIELD_MODELS.SOUL_STANDARD) {
    validateSoulStandard(input as SoulStandardInput)
    return
  }

  if (SOUL_GENERIC_MODELS.has(model)) {
    validateSoulImage(input as SoulImageBaseInput)
    return
  }

  if (model === HIGGSFIELD_MODELS.SOUL_REFERENCE) {
    validateSoulReference(input as SoulReferenceInput)
    return
  }

  if (model === HIGGSFIELD_MODELS.SOUL_CHARACTER) {
    validateSoulCharacter(input as SoulCharacterInput)
    return
  }

  if (model === HIGGSFIELD_MODELS.POPCORN_AUTO) {
    validatePopcornAuto(input as PopcornAutoInput)
    return
  }

  if (DOP_MODELS.has(model)) {
    validateDoP(input as DoPInput)
    return
  }

  if (DOP_FIRST_LAST_FRAME_MODELS.has(model)) {
    validateDoPFirstLastFrame(input as DoPFirstLastFrameInput)
    return
  }

  if (model === HIGGSFIELD_MODELS.QWEN_AUDIO_3_TTS_FLASH) {
    validateQwenAudio(input as QwenAudio3TtsFlashInput)
  }
}

function validateSoulStandard(input: SoulStandardInput): void {
  validateSoulImage(input)

  if (input.batch_size !== undefined && input.batch_size !== 1 && input.batch_size !== 4) {
    throw new HiggsfieldValidationError('batch_size must be either 1 or 4.', 'batch_size')
  }
}

function validateSoulImage(input: SoulImageBaseInput): void {
  assertNonEmptyString(input.prompt, 'prompt')
  validateBatchSize(input.batch_size, 4)
  validateStrength(input.style_strength, 'style_strength')
  validateSeed(input.seed)
}

function validateSoulReference(input: SoulReferenceInput): void {
  validateSoulImage(input)
  assertHttpUrl(input.image_reference_url, 'image_reference_url')
}

function validateSoulCharacter(input: SoulCharacterInput): void {
  validateSoulImage(input)
  assertNonEmptyString(input.custom_reference_id, 'custom_reference_id')
  validateStrength(input.custom_reference_strength, 'custom_reference_strength', true)

  if (input.image_reference_url !== undefined) {
    assertHttpUrl(input.image_reference_url, 'image_reference_url')
  }
}

function validatePopcornAuto(input: PopcornAutoInput): void {
  assertNonEmptyString(input.prompt, 'prompt')
  validateSeed(input.seed)

  if (
    input.num_images !== undefined &&
    (!Number.isInteger(input.num_images) || input.num_images < 1 || input.num_images > 8)
  ) {
    throw new HiggsfieldValidationError(
      'num_images must be an integer between 1 and 8.',
      'num_images',
    )
  }

  if (input.image_urls !== undefined) {
    assertUrlArray(input.image_urls, 'image_urls')
  }
}

function validateDoP(input: DoPInput): void {
  assertNonEmptyString(input.prompt, 'prompt')
  assertHttpUrl(input.image_url, 'image_url')

  if (input.motions !== undefined && !Array.isArray(input.motions)) {
    throw new HiggsfieldValidationError('motions must be an array.', 'motions')
  }

  if (
    input.duration !== undefined &&
    (!Number.isFinite(input.duration) || input.duration <= 0)
  ) {
    throw new HiggsfieldValidationError('duration must be a positive number.', 'duration')
  }

  validateSeed(input.seed)
}

function validateDoPFirstLastFrame(input: DoPFirstLastFrameInput): void {
  validateDoP(input)

  const candidate =
    input.last_frame_url ?? input.image_url_end ?? input.end_image_url

  if (candidate !== undefined) {
    assertHttpUrl(candidate, 'last_frame_url')
  }

  if (input.input_images_end !== undefined) {
    if (!Array.isArray(input.input_images_end) || input.input_images_end.length === 0) {
      throw new HiggsfieldValidationError(
        'input_images_end must be a non-empty array when provided.',
        'input_images_end',
      )
    }

    for (const [index, image] of input.input_images_end.entries()) {
      assertHttpUrl(image.image_url, `input_images_end.${index}.image_url`)
    }
  }
}

function validateQwenAudio(input: QwenAudio3TtsFlashInput): void {
  assertNonEmptyString(input.text, 'text')

  if (input.speed !== undefined && (!Number.isFinite(input.speed) || input.speed <= 0)) {
    throw new HiggsfieldValidationError('speed must be a positive number.', 'speed')
  }

  validateSeed(input.seed)
}

function validateSeed(seed: number | null | undefined): void {
  if (seed === undefined || seed === null) {
    return
  }

  if (!Number.isInteger(seed) || seed < 1 || seed > 1_000_000) {
    throw new HiggsfieldValidationError(
      'seed must be an integer between 1 and 1,000,000.',
      'seed',
    )
  }
}

function validateBatchSize(value: number | undefined, max: number): void {
  if (
    value !== undefined &&
    (!Number.isInteger(value) || value < 1 || value > max)
  ) {
    throw new HiggsfieldValidationError(
      `batch_size must be an integer between 1 and ${max}.`,
      'batch_size',
    )
  }
}

function validateStrength(
  value: number | undefined,
  field: string,
  required = false,
): void {
  if (value === undefined) {
    if (required) {
      throw new HiggsfieldValidationError(`${field} is required.`, field)
    }
    return
  }

  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new HiggsfieldValidationError(
      `${field} must be a number between 0 and 1.`,
      field,
    )
  }
}

function assertUrlArray(values: unknown[], field: string): void {
  for (const [index, value] of values.entries()) {
    assertHttpUrl(value, `${field}.${index}`)
  }
}

function assertNonEmptyString(value: unknown, field: string): asserts value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HiggsfieldValidationError(`${field} must be a non-empty string.`, field)
  }
}

function assertHttpUrl(value: unknown, field: string): asserts value is string {
  assertNonEmptyString(value, field)

  let url: URL
  try {
    url = new URL(value)
  } catch (error) {
    throw new HiggsfieldValidationError(`${field} must be a valid URL.`, field, {
      cause: error,
    })
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new HiggsfieldValidationError(`${field} must use HTTP or HTTPS.`, field)
  }
}

function assertSafeModelPath(value: string): void {
  if (value === '') {
    throw new HiggsfieldValidationError('model must be a non-empty string.', 'model')
  }

  if (
    value.startsWith('/') ||
    value.includes('://') ||
    value.includes('?') ||
    value.includes('#') ||
    value.split('/').some((segment) => segment === '.' || segment === '..' || segment === '')
  ) {
    throw new HiggsfieldValidationError('model must be a safe API model path.', 'model')
  }
}
