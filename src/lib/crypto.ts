import { randomBytes, timingSafeEqual } from 'node:crypto'

export function randomHex(bytes = 32) {
  return randomBytes(bytes).toString('hex')
}

export function constantTimeEqual(value: string, expected: string) {
  const valueBuffer = Buffer.from(value)
  const expectedBuffer = Buffer.from(expected)

  if (valueBuffer.length !== expectedBuffer.length) {
    return false
  }

  return timingSafeEqual(valueBuffer, expectedBuffer)
}
