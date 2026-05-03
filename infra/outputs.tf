output "ses_identity_arn" {
  value = aws_ses_domain_identity.mailing_list.arn
}

output "ses_verification_txt_name" {
  value = "_amazonses.${var.domain_name}"
}

output "ses_verification_txt_value" {
  value = aws_ses_domain_identity.mailing_list.verification_token
}

output "ses_dkim_cname_records" {
  value = [
    for token in aws_ses_domain_dkim.mailing_list.dkim_tokens : {
      name  = "${token}._domainkey.${var.domain_name}"
      value = "${token}.dkim.amazonses.com"
    }
  ]
}

output "sns_topic_arn" {
  value = aws_sns_topic.ses_bounces.arn
}

output "lambda_function_name" {
  value = aws_lambda_function.bounced_handler.function_name
}

output "bounced_endpoint" {
  value = local.bounce_endpoint
}
