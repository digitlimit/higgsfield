# @digitlimit/higgsfield

Production-grade TypeScript SDK for the asynchronous Higgsfield AI API.

```bash
npm install @digitlimit/higgsfield
```

## Features

- Strong TypeScript types for the Higgsfield models shown in the current Cloud model gallery
- Forward-compatible support for any canonical Higgsfield model ID
- Environment-based configuration
- Submit, status, poll, wait, result, and cancel operations
- Automatic `hf_webhook` callback configuration
- Framework-neutral webhook handler
- Dependency-free Node.js HTTP webhook adapter
- Pluggable webhook verification and distributed idempotency
- Retry policy for safe idempotent requests
- Abort signals and request/polling timeouts
- Zero runtime dependencies

## Requirements

- Node.js 18.17 or newer
- An active Higgsfield API key and secret

## Environment configuration

```dotenv
HIGGSFIELD_BASE_URL=https://platform.higgsfield.ai
HIGGSFIELD_KEY=your-api-key
HIGGSFIELD_SECRET=your-api-secret
HIGGSFIELD_CALLBACK=https://example.com/generations/higgsfield/callback
```

`HIGGSFIELD_CALLBACK` is optional. When configured, the SDK automatically sends it as the `hf_webhook` query parameter for every generation request.

The official `HF_API_KEY`, `HF_API_SECRET`, and combined `HF_KEY=api-key:api-secret` names remain supported for compatibility.

## Quick start

```ts
import { generateText } from '@digitlimit/higgsfield'

const result = await generateText({
  model: 'higgsfield/soul-standard',
  prompt: 'A cinematic portrait with soft studio lighting',
  batch_size: 1,
  resolution: '720p',
  aspect_ratio: '4:3',
  enhance_prompt: true,
  style_strength: 1,
})

console.log(result.images?.[0]?.url)
```

The package reads credentials and callback configuration from the environment when no explicit client configuration is supplied.

## Create a configured client

```ts
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
```

Explicit values take precedence over environment values.

## Submit without waiting

```ts
const request = await higgsfield.submit({
  model: 'higgsfield/soul-standard',
  prompt: 'A dramatic sunrise above a mountain ridge',
})

console.log(request.requestId)
```

The configured callback is attached automatically. Disable it for one request with:

```ts
await higgsfield.submit({
  model: 'higgsfield/soul-standard',
  prompt: 'A dramatic sunrise',
  webhookUrl: false,
})
```

Override it for one request with:

```ts
await higgsfield.submit({
  model: 'higgsfield/soul-standard',
  prompt: 'A dramatic sunrise',
  webhookUrl: 'https://another.example.com/higgsfield/callback',
})
```

## Status, polling, waiting, and cancellation

```ts
const requestId = 'd7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff'

const current = await higgsfield.status(requestId)
console.log(current.status)

for await (const update of higgsfield.poll(requestId, {
  intervalMs: 1_000,
  maxIntervalMs: 10_000,
  timeoutMs: 10 * 60_000,
  onStatus: (status) => console.log(status.status),
})) {
  console.log(update.status)
}

const terminal = await higgsfield.wait(requestId)

// Returns only a completed result. Throws HiggsfieldGenerationError for
// failed, NSFW, or cancelled terminal states.
const completed = await higgsfield.getResult(requestId)

// Higgsfield only accepts cancellation while the request is still queued.
await higgsfield.cancel(requestId)
```

The same operations are available as top-level functions:

```ts
import {
  cancel,
  getResult,
  getStatus,
  poll,
  wait,
} from '@digitlimit/higgsfield'
```

## Generate image-to-video

```ts
import { generateVideo } from '@digitlimit/higgsfield'

const result = await generateVideo({
  model: 'higgsfield/dop-turbo',
  image_url: 'https://example.com/first-frame.jpg',
  prompt: 'Smooth cinematic push-in, subtle movement in the subject and background',
  motions: [],
  enhance_prompt: true,
})

console.log(result.video?.url)
```

## Generate with a first and last frame

```ts
const result = await higgsfield.generate({
  model: 'higgsfield/dop-standard-first-last-frame',
  image_url: 'https://example.com/first-frame.jpg',
  last_frame_url: 'https://example.com/last-frame.jpg',
  prompt: 'A smooth controlled transition between both frames',
  motions: [],
})
```

## Framework-neutral webhook handler

The handler accepts raw JSON text, `Uint8Array`, or an already parsed object. Raw input is required when a custom verifier needs the exact request bytes.

```ts
import {
  createWebhookHandler,
  type WebhookIdempotencyStore,
} from '@digitlimit/higgsfield'

const idempotency: WebhookIdempotencyStore = {
  async acquire(requestId) {
    // Use a database unique constraint or Redis SET NX in production.
    // Return false when the request ID was already processed.
    return reserveRequestIdAtomically(requestId)
  },
  async release(requestId) {
    await releaseRequestIdReservation(requestId)
  },
}

const webhook = createWebhookHandler({
  idempotency,

  // Higgsfield does not currently document a standard webhook signature in
  // the supplied API guide. Add application-specific verification here when
  // you have a trusted header/token contract.
  verify: ({ body, headers }) => verifyYourWebhook(body, headers),

  handlers: {
    async completed(event) {
      await saveGeneratedMedia(event.request_id, event.images, event.video, event.audio)
    },

    async failed(event) {
      await markGenerationFailed(event.request_id, event.error)
    },

    async nsfw(event) {
      await markGenerationRejected(event.request_id, 'nsfw')
    },

    async cancelled(event) {
      await markGenerationCancelled(event.request_id)
    },
  },
})
```

Use the same handler from any framework:

```ts
const result = await webhook.handle({
  method: incomingMethod,
  headers: incomingHeaders,
  body: rawRequestBody,
})

return new Response(result.body, {
  status: result.statusCode,
  headers: result.headers,
})
```

### Node.js HTTP server

```ts
import { createServer } from 'node:http'
import { createWebhookHandler } from '@digitlimit/higgsfield'

const webhook = createWebhookHandler({
  handlers: {
    completed: async (event) => {
      console.log('Completed:', event.request_id)
    },
  },
})

createServer(async (request, response) => {
  if (request.url !== '/generations/higgsfield/callback') {
    response.statusCode = 404
    response.end('Not found')
    return
  }

  await webhook.handleNode(request, response)
}).listen(3000)
```

### Express

Use `express.raw()` so a verifier can receive the unmodified request bytes.

```ts
import express from 'express'
import { createWebhookHandler } from '@digitlimit/higgsfield'

const app = express()
const webhook = createWebhookHandler({
  onEvent: async (event) => {
    console.log(event.request_id, event.status)
  },
})

app.post(
  '/generations/higgsfield/callback',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (request, response) => {
    const result = await webhook.handle({
      method: request.method,
      headers: request.headers,
      body: new Uint8Array(request.body),
    })

    for (const [name, value] of Object.entries(result.headers)) {
      response.setHeader(name, value)
    }

    response.status(result.statusCode).send(result.body)
  },
)
```

## Webhook idempotency

Higgsfield retries failed webhook deliveries. A production service should use a shared, atomic idempotency implementation so multiple application instances cannot process the same `request_id` twice.

The SDK exposes `MemoryWebhookIdempotencyStore` for tests and single-process development. Do not use it as the sole deduplication mechanism in a horizontally scaled production deployment.

```ts
import {
  createWebhookHandler,
  MemoryWebhookIdempotencyStore,
} from '@digitlimit/higgsfield'

const webhook = createWebhookHandler({
  idempotency: new MemoryWebhookIdempotencyStore(),
})
```

## Supported typed model catalogue

Use constants to avoid string mistakes:

```ts
import { HIGGSFIELD_MODELS } from '@digitlimit/higgsfield'

await higgsfield.generate({
  model: HIGGSFIELD_MODELS.SOUL_REFERENCE,
  prompt: 'A cinematic fashion portrait',
  image_reference_url: 'https://example.com/reference.jpg',
})
```

| Model | Canonical ID | Friendly alias |
|---|---|---|
| Soul Standard | `higgsfield-ai/soul/standard` | `higgsfield/soul-standard` |
| Soul 2 | `higgsfield-ai/soul/2` | `higgsfield/soul-2` |
| Soul Character | `higgsfield-ai/soul/character` | `higgsfield/soul-character` |
| Soul Cinema | `higgsfield-ai/soul/cinema` | `higgsfield/soul-cinema` |
| Soul Reference | `higgsfield-ai/soul/reference` | `higgsfield/soul-reference` |
| Soul ID | `higgsfield-ai/soul/id` | `higgsfield/soul-id` |
| Popcorn Auto | `higgsfield-ai/popcorn/auto` | `higgsfield/popcorn-auto` |
| DoP Lite | `higgsfield-ai/dop/lite` | `higgsfield/dop-lite` |
| DoP Lite first/last frame | `higgsfield-ai/dop/lite/first-last-frame` | `higgsfield/dop-lite-first-last-frame` |
| DoP Standard | `higgsfield-ai/dop/standard` | `higgsfield/dop-standard` |
| DoP Standard first/last frame | `higgsfield-ai/dop/standard/first-last-frame` | `higgsfield/dop-standard-first-last-frame` |
| DoP Turbo | `higgsfield-ai/dop/turbo` | `higgsfield/dop-turbo` |
| DoP Turbo first/last frame | `higgsfield-ai/dop/turbo/first-last-frame` | `higgsfield/dop-turbo-first-last-frame` |
| Qwen Audio 3.0 TTS Flash | `qwen/qwen-audio-3.0-tts-flash` | `qwen/audio-3.0-tts-flash` |

Higgsfield continuously adds models. Any safe canonical model path remains accepted even before a dedicated SDK type is released:

```ts
await higgsfield.submit({
  model: 'provider/new-model/version',
  prompt: 'Forward-compatible request',
  provider_specific_field: true,
})
```

## Model-specific input types

```ts
import type {
  DoPInput,
  PopcornAutoInput,
  QwenAudio3TtsFlashInput,
  Soul2Input,
  SoulCharacterInput,
  SoulCinemaInput,
  SoulIdInput,
  SoulReferenceInput,
  SoulStandardInput,
} from '@digitlimit/higgsfield'
```

`SoulIdInput` and third-party model inputs remain extensible because those model schemas can evolve independently of the SDK.

## Motions and Soul styles

```ts
const motions = await higgsfield.listMotions()
const styles = await higgsfield.listSoulStyles()
```

## Error handling

```ts
import {
  HiggsfieldApiError,
  HiggsfieldGenerationError,
  HiggsfieldTimeoutError,
  HiggsfieldValidationError,
} from '@digitlimit/higgsfield'

try {
  await higgsfield.getResult('request-id')
} catch (error) {
  if (error instanceof HiggsfieldGenerationError) {
    console.error(error.response.status, error.response)
  } else if (error instanceof HiggsfieldApiError) {
    console.error(error.status, error.requestId, error.body)
  } else if (error instanceof HiggsfieldTimeoutError) {
    console.error(error.lastResponse)
  } else if (error instanceof HiggsfieldValidationError) {
    console.error(error.field, error.message)
  }
}
```

## Retry behaviour

The default retry policy retries safe `GET` operations for transient network failures and HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504` responses.

Generation `POST` requests are not retried automatically because doing so can create duplicate paid jobs. Application code should only retry submission when it has its own idempotency and reconciliation strategy.

## Development

```bash
npm run typecheck
npm test
npm run test:types
npm run check
npm pack
```

## Licence

MIT
