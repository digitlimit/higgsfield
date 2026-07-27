import { createServer } from 'node:http'
import { createWebhookHandler } from '@digitlimit/higgsfield'

const webhook = createWebhookHandler({
  handlers: {
    completed: async (event) => {
      console.log('Completed:', event.request_id)
    },
    failed: async (event) => {
      console.error('Failed:', event.request_id, event.error)
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
