package dashboard

import (
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/services"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "modernc.org/sqlite"
)

func registerMailerPanel(app *fiber.App) {
	app.Get("/dashboard/mailer", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return utils.Render(c, mailer(auth.IsAuthenticated(c)))
	})

	app.Post("/actions/send-emails", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		subject := c.FormValue("subject")
		html := c.FormValue("html")
		text := c.FormValue("text")

		emails := dataAccess.GetEmails()

		emailChannel := make(chan services.EmailData, len(emails))

		go func() {
			ticker := time.NewTicker(200 * time.Millisecond)
			defer ticker.Stop()

			for email := range emailChannel {
				<-ticker.C
				services.SendEmail(email)
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
