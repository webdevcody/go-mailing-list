import { z } from 'zod'

const emailSchema = z.string().trim().email()

export type ParsedEmails = {
  valid: Array<string>
  invalid: Array<string>
}

export function parseEmailLines(input: string): ParsedEmails {
  const seen = new Set<string>()
  const valid: Array<string> = []
  const invalid: Array<string> = []

  for (const rawLine of input.split(/\r?\n/)) {
    const line = rawLine.trim().toLowerCase()

    if (!line) {
      continue
    }

    const parsed = emailSchema.safeParse(line)

    if (!parsed.success) {
      invalid.push(rawLine.trim())
      continue
    }

    if (!seen.has(parsed.data)) {
      seen.add(parsed.data)
      valid.push(parsed.data)
    }
  }

  return { valid, invalid }
}

export function isEmail(value: string) {
  return emailSchema.safeParse(value).success
}
