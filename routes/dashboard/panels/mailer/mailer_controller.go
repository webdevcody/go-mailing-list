package mailer

import (
	"fmt"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/services"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

func RegisterMailerPanel(app *fiber.App) {
	app.Get("/dashboard/mailer", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return utils.Render(c, mailer(auth.IsAuthenticated(c)))
	})

	app.Post("/actions/send-emails", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		subject := c.FormValue("subject")
		html := c.FormValue("html")
		text := c.FormValue("text")
		tester := c.FormValue("tester")

		emails := make([]dataAccess.Email, 0)

		if tester != "" {
			emails = append(emails, dataAccess.Email{
				Email: tester,
			})
		} else {
			emails = dataAccess.GetEmails()
		}
		totalEmails := len(emails)

		emailChannel := make(chan services.EmailData, totalEmails)

		go func() {
			ticker := time.NewTicker(200 * time.Millisecond)
			defer ticker.Stop()

			for email := range emailChannel {
				<-ticker.C
				services.SendEmail(email)
				totalEmails--
				fmt.Printf("Remaining emails: %d\n", totalEmails)
			}
		}()

		go func() {
			for _, email := range emails {
				emailChannel <- services.EmailData{
					Email:         email.Email,
					HtmlBody:      html,
					Subject:       subject,
					UnsubscribeId: email.Id,
					TextBody:      text,
				}
			}
			close(emailChannel)
		}()

		return c.Redirect("/dashboard/mailer")
	})
}
