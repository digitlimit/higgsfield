export function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

export function createFetchQueue(responses) {
  const calls = []
  let index = 0

  const fetch = async (input, init = {}) => {
    calls.push({ input: String(input), init })
    const response = responses[index]
    index += 1

    if (response instanceof Error) {
      throw response
    }

    if (typeof response === 'function') {
      return response(input, init, calls)
    }

    if (response === undefined) {
      throw new Error(`No mock response configured for call ${index}.`)
    }

    return response
  }

  return { fetch, calls }
}
