import mjml2html from 'mjml'
import { htmlToText } from 'html-to-text'

export type ConvertedMjml = {
  html: string
  text: string
  errors: Array<string>
}

export async function convertMjml(input: string): Promise<ConvertedMjml> {
  const result = await mjml2html(input, {
    minify: true,
    validationLevel: 'soft',
  })

  const text = htmlToText(result.html, {
    wordwrap: false,
    selectors: [{ selector: 'img', format: 'skip' }],
  })

  return {
    html: result.html,
    text,
    errors: result.errors.map((error: { formattedMessage: string }) => error.formattedMessage),
  }
}
