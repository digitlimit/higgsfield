import { createHiggsfield } from '@digitlimit/higgsfield'

const client = createHiggsfield()

const request = await client.submit({
  model: 'higgsfield/soul-standard',
  prompt: 'A dramatic sunrise above a mountain ridge',
  webhookUrl: 'https://example.com/webhooks/higgsfield',
  onEnqueue: (requestId) => {
    console.log('Queued:', requestId)
  },
})

for await (const status of request.poll({
  onStatus: (event) => console.log(event.status),
})) {
  if (status.status === 'completed') {
    console.log(status.images?.[0]?.url)
  }
}
