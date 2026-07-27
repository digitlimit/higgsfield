import { HiggsfieldAbortError } from '../errors.js'

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted === true) {
    throw abortError(signal)
  }

  if (ms <= 0) {
    await Promise.resolve()
    return
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup()
      resolve()
    }, ms)

    const onAbort = (): void => {
      clearTimeout(timer)
      cleanup()
      reject(abortError(signal))
    }

    const cleanup = (): void => {
      signal?.removeEventListener('abort', onAbort)
    }

    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export function jitter(value: number, ratio: number): number {
  if (ratio === 0 || value === 0) {
    return value
  }

  const spread = value * ratio
  return Math.max(0, value - spread + Math.random() * spread * 2)
}

export function abortError(signal?: AbortSignal): HiggsfieldAbortError {
  const reason = signal?.reason
  if (reason instanceof Error) {
    return new HiggsfieldAbortError(reason.message, { cause: reason })
  }

  return new HiggsfieldAbortError('The operation was aborted.')
}

export function isAbortLike(error: unknown): boolean {
  return (
    error instanceof HiggsfieldAbortError ||
    (error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError'))
  )
}
