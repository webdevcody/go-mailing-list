#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INFRA_DIR="${ROOT_DIR}/infra"

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "Missing ${name}. Set it before running this script." >&2
    exit 1
  fi
}

require_env TF_VAR_domain_name
require_env TF_VAR_app_url
require_env TF_VAR_api_token

AWS_REGION="${TF_VAR_aws_region:-us-east-1}"
PROJECT_NAME="${TF_VAR_project_name:-go-mailing-list}"
LAMBDA_NAME="${TF_VAR_lambda_name:-${PROJECT_NAME}-bounced-handler}"
LAMBDA_ROLE_NAME="${TF_VAR_lambda_role_name:-${LAMBDA_NAME}-role}"
LAMBDA_BASIC_POLICY_ARN="${TF_VAR_lambda_basic_policy_arn:-arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole}"
LAMBDA_PERMISSION_STATEMENT_ID="${TF_VAR_lambda_permission_statement_id:-AllowExecutionFromSnsSesBounces}"
SNS_TOPIC_NAME="${TF_VAR_sns_topic_name:-${PROJECT_NAME}-ses-bounces}"
MAIL_FROM_DOMAIN="${TF_VAR_mail_from_domain:-}"
ROUTE53_ZONE_ID="${TF_VAR_route53_zone_id:-}"
FORWARD_COMPLAINTS="${TF_VAR_forward_complaints:-true}"

cd "${INFRA_DIR}"

terraform init

state_has() {
  terraform state list 2>/dev/null | grep -Fxq "$1"
}

import_if_missing() {
  local address="$1"
  local id="$2"

  if state_has "${address}"; then
    return
  fi

  echo "Importing ${address} (${id}) if it already exists..."
  terraform import "${address}" "${id}" || true
}

ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
SNS_TOPIC_ARN="arn:aws:sns:${AWS_REGION}:${ACCOUNT_ID}:${SNS_TOPIC_NAME}"

import_if_missing "aws_ses_domain_identity.mailing_list" "${TF_VAR_domain_name}"
import_if_missing "aws_ses_domain_dkim.mailing_list" "${TF_VAR_domain_name}"
import_if_missing "aws_sns_topic.ses_bounces" "${SNS_TOPIC_ARN}"
import_if_missing "aws_iam_role.bounced_handler" "${LAMBDA_ROLE_NAME}"
import_if_missing "aws_iam_role_policy_attachment.bounced_handler_basic" "${LAMBDA_ROLE_NAME}/${LAMBDA_BASIC_POLICY_ARN}"
import_if_missing "aws_lambda_function.bounced_handler" "${LAMBDA_NAME}"
import_if_missing "aws_lambda_permission.allow_sns_bounced_handler" "${LAMBDA_NAME}/${LAMBDA_PERMISSION_STATEMENT_ID}"
import_if_missing "aws_ses_identity_notification_topic.bounces" "${TF_VAR_domain_name}|Bounce"

if [[ "${FORWARD_COMPLAINTS}" == "true" ]]; then
  import_if_missing "aws_ses_identity_notification_topic.complaints[0]" "${TF_VAR_domain_name}|Complaint"
fi

if [[ -n "${MAIL_FROM_DOMAIN}" ]]; then
  import_if_missing "aws_ses_domain_mail_from.mailing_list[0]" "${TF_VAR_domain_name}"
fi

if [[ -n "${ROUTE53_ZONE_ID}" ]]; then
  import_if_missing "aws_route53_record.ses_verification[0]" "${ROUTE53_ZONE_ID}__amazonses.${TF_VAR_domain_name}_TXT"

  DKIM_RECORDS="$(terraform output -json ses_dkim_cname_records 2>/dev/null || true)"
  if [[ -n "${DKIM_RECORDS}" ]]; then
    echo "${DKIM_RECORDS}" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{JSON.parse(s).forEach((r,i)=>console.log(`${i}\t${r.name}`))}catch{}})' |
      while IFS=$'\t' read -r index record_name; do
        import_if_missing "aws_route53_record.ses_dkim[${index}]" "${ROUTE53_ZONE_ID}_${record_name}_CNAME"
      done
  fi

  if [[ -n "${MAIL_FROM_DOMAIN}" ]]; then
    import_if_missing "aws_route53_record.mail_from_mx[0]" "${ROUTE53_ZONE_ID}_${MAIL_FROM_DOMAIN}_MX"
    import_if_missing "aws_route53_record.mail_from_spf[0]" "${ROUTE53_ZONE_ID}_${MAIL_FROM_DOMAIN}_TXT"
  fi
fi

SUBSCRIPTION_ARN="$(aws sns list-subscriptions-by-topic \
  --region "${AWS_REGION}" \
  --topic-arn "${SNS_TOPIC_ARN}" \
  --query "Subscriptions[?Protocol=='lambda' && contains(Endpoint, ':function:${LAMBDA_NAME}')].SubscriptionArn | [0]" \
  --output text 2>/dev/null || true)"

if [[ -n "${SUBSCRIPTION_ARN}" && "${SUBSCRIPTION_ARN}" != "None" ]]; then
  import_if_missing "aws_sns_topic_subscription.bounced_handler" "${SUBSCRIPTION_ARN}"
fi

terraform apply -auto-approve
