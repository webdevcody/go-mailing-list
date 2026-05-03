variable "aws_region" {
  description = "AWS region where SES and Lambda resources live."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Prefix used for managed AWS resource names."
  type        = string
  default     = "go-mailing-list"
}

variable "domain_name" {
  description = "SES verified domain, for example example.com."
  type        = string
}

variable "app_url" {
  description = "Public app URL. The Lambda posts bounces to /api/bounced on this host."
  type        = string
}

variable "api_token" {
  description = "Bearer token sent by the Lambda to /api/bounced. Set this to the app's BOUNCE_WEBHOOK_SECRET value (NOT the login PASSWORD)."
  type        = string
  sensitive   = true
}

variable "lambda_name" {
  description = "Existing or desired Lambda function name. Defaults to <project_name>-bounced-handler."
  type        = string
  default     = null
}

variable "lambda_role_name" {
  description = "Existing or desired Lambda IAM role name. Defaults to <lambda_name>-role."
  type        = string
  default     = null
}

variable "lambda_role_path" {
  description = "IAM path for the Lambda role. Existing console-created Lambda roles usually use /service-role/."
  type        = string
  default     = "/"
}

variable "lambda_basic_policy_arn" {
  description = "Policy ARN attached to the Lambda role for basic CloudWatch logging."
  type        = string
  default     = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

variable "lambda_permission_statement_id" {
  description = "Existing or desired Lambda permission statement ID allowing SNS invocation."
  type        = string
  default     = "AllowExecutionFromSnsSesBounces"
}

variable "sns_topic_name" {
  description = "Existing or desired SNS topic name. Defaults to <project_name>-ses-bounces."
  type        = string
  default     = null
}

variable "route53_zone_id" {
  description = "Optional Route53 hosted zone ID. When set, Terraform manages SES DNS records."
  type        = string
  default     = ""
}

variable "mail_from_domain" {
  description = "Optional custom MAIL FROM domain, for example mail.example.com."
  type        = string
  default     = ""
}

variable "forward_complaints" {
  description = "Whether complaint notifications should use the same handler path."
  type        = bool
  default     = true
}
