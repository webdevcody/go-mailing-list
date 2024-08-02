package services

import (
	"fmt"
	"os"
	"strconv"

	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/ses"
)

type EmailData struct {
	Email         string
	HtmlBody      string
	Subject       string
	TextBody      string
	UnsubscribeId int64
}

const charSet = "UTF-8"

var sender = os.Getenv("SENDER_EMAIL")
var hostname = os.Getenv("HOST_NAME")
var isLocal = os.Getenv("IS_LOCAL") == "true"

func SendEmail(emailData EmailData) {

	if isLocal {
		fmt.Printf("Mock email sent to: %s\n", emailData.Email)
		return
	}

	unsubscribeLinkHtml := fmt.Sprintf("<div style=\"text-align: center;\">Seibert Software Solutions, LLC<br/>PO Box 913<br/>Harrison TN, 37341<br /><br /> <a href=\"%s/unsubscribe/%s\" target=\"_blank;\">Unsubscribe</a></div>",
		hostname,
		strconv.FormatInt(emailData.UnsubscribeId, 10),
	)
	unsubscribeLinkText := fmt.Sprintf("Seibert Software Solutions, LLC @ PO Box 913, Harrison TN, 37341, You can unsubscribe here: %s/unsubscribe/%s", hostname, strconv.FormatInt(emailData.UnsubscribeId, 10))

	sess, err := session.NewSession(&aws.Config{
		Region: aws.String("us-east-1")},
	)

	if err != nil {
		fmt.Println("Error creating session: ", err)
		return
	}

	svc := ses.New(sess)

	input := &ses.SendEmailInput{
		Destination: &ses.Destination{
			CcAddresses: []*string{},
			ToAddresses: []*string{
				aws.String(emailData.Email),
			},
		},
		Message: &ses.Message{
			Body: &ses.Body{
				Html: &ses.Content{
					Charset: aws.String(charSet),
					Data:    aws.String(emailData.HtmlBody + unsubscribeLinkHtml),
				},
				Text: &ses.Content{
					Charset: aws.String(charSet),
					Data:    aws.String(emailData.TextBody + unsubscribeLinkText),
				},
			},
			Subject: &ses.Content{
				Charset: aws.String(charSet),
				Data:    aws.String(emailData.Subject),
			},
		},
		Source: aws.String(sender),
	}

	result, err := svc.SendEmail(input)

	// Display error messages if they occur.
	if err != nil {
		if aerr, ok := err.(awserr.Error); ok {
			switch aerr.Code() {
			case ses.ErrCodeMessageRejected:
				fmt.Println(ses.ErrCodeMessageRejected, aerr.Error())
			case ses.ErrCodeMailFromDomainNotVerifiedException:
				fmt.Println(ses.ErrCodeMailFromDomainNotVerifiedException, aerr.Error())
			case ses.ErrCodeConfigurationSetDoesNotExistException:
				fmt.Println(ses.ErrCodeConfigurationSetDoesNotExistException, aerr.Error())
			default:
				fmt.Println(aerr.Error())
			}
		} else {
			fmt.Println(err.Error())
		}
		return
	}

	fmt.Println("Email Sent to address: " + emailData.Email)
	fmt.Println(result)
}
