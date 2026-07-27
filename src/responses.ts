import { HiggsfieldValidationError } from './errors.js'
import type {
  CompletedGenerationResponse,
  GenerationResponse,
  GenerationStatus,
  TerminalGenerationResponse,
  UnknownRecord,
} from './types.js'

const STATUSES = new Set<GenerationStatus>([
  'queued',
  'in_progress',
  'nsfw',
  'failed',
  'completed',
  'cancelled',
  'canceled',
])

export function parseGenerationResponse(value: unknown): GenerationResponse {
  if (!isRecord(value)) {
    throw new HiggsfieldValidationError('Higgsfield returned a non-object response.')
  }

  const status = value['status']
  const requestId = value['request_id']

  if (typeof status !== 'string' || !STATUSES.has(status as GenerationStatus)) {
    throw new HiggsfieldValidationError('Higgsfield returned an unknown generation status.')
  }

  if (typeof requestId !== 'string' || requestId.trim() === '') {
    throw new HiggsfieldValidationError('Higgsfield response is missing request_id.')
  }

  return value as GenerationResponse
}

export function isTerminalResponse(
  response: GenerationResponse,
): response is TerminalGenerationResponse {
  return (
    response.status === 'completed' ||
    response.status === 'failed' ||
    response.status === 'nsfw' ||
    response.status === 'cancelled' ||
    response.status === 'canceled'
  )
}

export function isCompletedResponse(
  response: GenerationResponse,
): response is CompletedGenerationResponse {
  return response.status === 'completed'
}

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
