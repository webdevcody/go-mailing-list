import {
  SESClient,
  SendEmailCommand,
  MessageRejected,
  MailFromDomainNotVerifiedException,
  ConfigurationSetDoesNotExistException,
} from '@aws-sdk/client-ses'
import type { Email } from '~/db/schema'
import { listEmails } from '~/data-access/emails'

export type SendEmailInput = {
  subject: string
  html: string
  text: string
  tester?: string
}

type EmailData = {
  email: string
  html: string
  text: string
  subject: string
  unsubscribeId?: string | null
}

const charset = 'UTF-8'

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function sendEmails(input: SendEmailInput) {
  const recipients: Array<Pick<Email, 'email' | 'unsubscribeId'>> = input.tester
    ? [{ email: input.tester, unsubscribeId: null }]
    : await listEmails()

  let sent = 0

  for (const recipient of recipients) {
    if (!recipient.email) {
      continue
    }

    await sendEmail({
      email: recipient.email,
      html: input.html,
      text: input.text,
      subject: input.subject,
      unsubscribeId: recipient.unsubscribeId,
    })
    sent += 1
    await wait(200)
  }

  return { sent }
}

async function sendEmail(emailData: EmailData) {
  if (process.env.IS_LOCAL === 'true') {
    console.info(`Mock email sent to: ${emailData.email}`)
    return
  }

  const sender = process.env.SENDER_EMAIL
  const hostname = process.env.HOST_NAME

  if (!sender || !hostname) {
    throw new Error('SENDER_EMAIL and HOST_NAME are required to send email')
  }

  const unsubscribeLinkHtml = emailData.unsubscribeId
    ? `<div style="text-align: center;">Seibert Software Solutions, LLC<br/>PO Box 913<br/>Harrison TN, 37341<br /><br /> <a href="${hostname}/unsubscribe/${emailData.unsubscribeId}" target="_blank;">Unsubscribe</a></div>`
    : ''
  const unsubscribeLinkText = emailData.unsubscribeId
    ? `Seibert Software Solutions, LLC @ PO Box 913, Harrison TN, 37341, You can unsubscribe here: ${hostname}/unsubscribe/${emailData.unsubscribeId}`
    : ''

  const client = new SESClient({ region: 'us-east-1' })

  try {
    await client.send(
      new SendEmailCommand({
        Destination: {
          CcAddresses: [],
          ToAddresses: [emailData.email],
        },
        Message: {
          Body: {
            Html: {
              Charset: charset,
              Data: emailData.html + unsubscribeLinkHtml,
            },
            Text: {
              Charset: charset,
              Data: emailData.text + unsubscribeLinkText,
            },
          },
          Subject: {
            Charset: charset,
            Data: emailData.subject,
          },
        },
        Source: sender,
      }),
    )
  } catch (error) {
    if (
      error instanceof MessageRejected ||
      error instanceof MailFromDomainNotVerifiedException ||
      error instanceof ConfigurationSetDoesNotExistException
    ) {
      console.error(error.name, error.message)
      return
    }

    throw error
  }
}
