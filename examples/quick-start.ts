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
