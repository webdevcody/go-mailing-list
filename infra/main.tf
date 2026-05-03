terraform {
  required_version = ">= 1.5.0"

  required_providers {
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.7"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

locals {
  lambda_name      = coalesce(var.lambda_name, "${var.project_name}-bounced-handler")
  lambda_role_name = coalesce(var.lambda_role_name, "${local.lambda_name}-role")
  sns_topic_name   = coalesce(var.sns_topic_name, "${var.project_name}-ses-bounces")
  bounce_endpoint  = "${trimsuffix(var.app_url, "/")}/api/bounced"
  use_route53_zone = var.route53_zone_id != ""
}

data "aws_caller_identity" "current" {}

resource "aws_ses_domain_identity" "mailing_list" {
  domain = var.domain_name
}

resource "aws_ses_domain_dkim" "mailing_list" {
  domain = aws_ses_domain_identity.mailing_list.domain
}

resource "aws_ses_domain_mail_from" "mailing_list" {
  count = var.mail_from_domain == "" ? 0 : 1

  domain           = aws_ses_domain_identity.mailing_list.domain
  mail_from_domain = var.mail_from_domain
}

resource "aws_route53_record" "ses_verification" {
  count = local.use_route53_zone ? 1 : 0

  zone_id = var.route53_zone_id
  name    = "_amazonses.${var.domain_name}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.mailing_list.verification_token]
}

resource "aws_route53_record" "ses_dkim" {
  count = local.use_route53_zone ? 3 : 0

  zone_id = var.route53_zone_id
  name    = "${aws_ses_domain_dkim.mailing_list.dkim_tokens[count.index]}._domainkey.${var.domain_name}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.mailing_list.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_route53_record" "mail_from_mx" {
  count = local.use_route53_zone && var.mail_from_domain != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "mail_from_spf" {
  count = local.use_route53_zone && var.mail_from_domain != "" ? 1 : 0

  zone_id = var.route53_zone_id
  name    = var.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com -all"]
}

data "archive_file" "bounced_handler" {
  type        = "zip"
  source_file = "${path.module}/../lambda/bounced-handler.js"
  output_path = "${path.module}/.terraform/build/bounced-handler.zip"
}

resource "aws_iam_role" "bounced_handler" {
  name = local.lambda_role_name
  path = var.lambda_role_path

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "bounced_handler_basic" {
  role       = aws_iam_role.bounced_handler.name
  policy_arn = var.lambda_basic_policy_arn
}

resource "aws_lambda_function" "bounced_handler" {
  function_name    = local.lambda_name
  role             = aws_iam_role.bounced_handler.arn
  handler          = "bounced-handler.handler"
  runtime          = "nodejs22.x"
  filename         = data.archive_file.bounced_handler.output_path
  source_code_hash = data.archive_file.bounced_handler.output_base64sha256
  timeout          = 30

  environment {
    variables = {
      API_TOKEN        = var.api_token
      BOUNCED_ENDPOINT = local.bounce_endpoint
    }
  }
}

resource "aws_sns_topic" "ses_bounces" {
  name = local.sns_topic_name
}

resource "aws_lambda_permission" "allow_sns_bounced_handler" {
  statement_id  = var.lambda_permission_statement_id
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.bounced_handler.function_name
  principal     = "sns.amazonaws.com"
  source_arn    = aws_sns_topic.ses_bounces.arn
}

resource "aws_sns_topic_subscription" "bounced_handler" {
  topic_arn = aws_sns_topic.ses_bounces.arn
  protocol  = "lambda"
  endpoint  = aws_lambda_function.bounced_handler.arn
}

resource "aws_ses_identity_notification_topic" "bounces" {
  identity                 = aws_ses_domain_identity.mailing_list.domain
  notification_type        = "Bounce"
  topic_arn                = aws_sns_topic.ses_bounces.arn
  include_original_headers = true
}

resource "aws_ses_identity_notification_topic" "complaints" {
  count = var.forward_complaints ? 1 : 0

  identity                 = aws_ses_domain_identity.mailing_list.domain
  notification_type        = "Complaint"
  topic_arn                = aws_sns_topic.ses_bounces.arn
  include_original_headers = true
}
