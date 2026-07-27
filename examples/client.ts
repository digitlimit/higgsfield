import { createHiggsfield } from '@digitlimit/higgsfield'

const higgsfield = createHiggsfield({
  baseUrl: process.env.HIGGSFIELD_BASE_URL,
  apiKey: process.env.HIGGSFIELD_KEY,
  apiSecret: process.env.HIGGSFIELD_SECRET,
  callbackUrl: process.env.HIGGSFIELD_CALLBACK,
  timeoutMs: 30_000,
  retry: {
    maxRetries: 3,
  },
  polling: {
    intervalMs: 1_000,
    maxIntervalMs: 10_000,
    timeoutMs: 10 * 60_000,
  },
})

const result = await higgsfield.generate({
  model: 'higgsfield/dop-lite',
  image_url: 'https://example.com/first-frame.jpg',
  prompt: 'Slow cinematic push-in, subtle natural movement',
  motions: [],
  enhance_prompt: true,
})

console.log(result.video?.url)
