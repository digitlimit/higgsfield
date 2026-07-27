import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HiggsfieldValidationError,
  resolveModelId,
} from '../dist/index.js'

test('resolves the friendly model alias to the canonical endpoint', () => {
  assert.equal(
    resolveModelId('higgsfield/soul-standard'),
    'higgsfield-ai/soul/standard',
  )
  assert.equal(
    resolveModelId('higgsfield/dop-standard-first-last-frame'),
    'higgsfield-ai/dop/standard/first-last-frame',
  )
})

test('supports future Higgsfield aliases without an SDK release', () => {
  assert.equal(
    resolveModelId('higgsfield/soul-cinema'),
    'higgsfield-ai/soul/cinema',
  )
})

test('preserves canonical third-party model IDs', () => {
  assert.equal(
    resolveModelId('kling-video/v2.1/pro/image-to-video'),
    'kling-video/v2.1/pro/image-to-video',
  )
})

test('rejects unsafe model paths', () => {
  assert.throws(
    () => resolveModelId('../requests/private'),
    HiggsfieldValidationError,
  )
})

test('exports the complete typed model catalogue covered by the package', async () => {
  const { HIGGSFIELD_MODELS } = await import('../dist/index.js')

  assert.equal(HIGGSFIELD_MODELS.SOUL_2, 'higgsfield-ai/soul/2')
  assert.equal(HIGGSFIELD_MODELS.SOUL_CHARACTER, 'higgsfield-ai/soul/character')
  assert.equal(HIGGSFIELD_MODELS.SOUL_CINEMA, 'higgsfield-ai/soul/cinema')
  assert.equal(HIGGSFIELD_MODELS.SOUL_ID, 'higgsfield-ai/soul/id')
  assert.equal(HIGGSFIELD_MODELS.SOUL_REFERENCE, 'higgsfield-ai/soul/reference')
  assert.equal(HIGGSFIELD_MODELS.POPCORN_AUTO, 'higgsfield-ai/popcorn/auto')
  assert.equal(
    HIGGSFIELD_MODELS.QWEN_AUDIO_3_TTS_FLASH,
    'qwen/qwen-audio-3.0-tts-flash',
  )
})
