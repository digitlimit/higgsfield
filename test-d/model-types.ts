import {
  HIGGSFIELD_MODELS,
  generateAudio,
  generateImage,
  generateVideo,
  type InputForModel,
} from '../dist/index.js'

const soul: InputForModel<'higgsfield/soul-standard'> = {
  prompt: 'A cinematic portrait',
  batch_size: 1,
  resolution: '720p',
}
void soul

void generateImage({
  model: HIGGSFIELD_MODELS.SOUL_REFERENCE,
  prompt: 'A cinematic portrait',
  image_reference_url: 'https://example.com/reference.jpg',
})

void generateVideo({
  model: HIGGSFIELD_MODELS.DOP_TURBO,
  prompt: 'Slow camera push in',
  image_url: 'https://example.com/frame.jpg',
})

void generateAudio({
  model: HIGGSFIELD_MODELS.QWEN_AUDIO_3_TTS_FLASH,
  text: 'Hello from Higgsfield',
})

// @ts-expect-error Soul Reference requires image_reference_url.
void generateImage({
  model: HIGGSFIELD_MODELS.SOUL_REFERENCE,
  prompt: 'Missing reference',
})

// @ts-expect-error DoP requires image_url.
void generateVideo({
  model: HIGGSFIELD_MODELS.DOP_LITE,
  prompt: 'Missing frame',
})
