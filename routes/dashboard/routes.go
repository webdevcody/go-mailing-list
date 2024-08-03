package dashboard

import (
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	"github.com/webdevcody/go-mailing-list/routes/dashboard/panels/bounced"
	"github.com/webdevcody/go-mailing-list/routes/dashboard/panels/compose"
	"github.com/webdevcody/go-mailing-list/routes/dashboard/panels/list"
	"github.com/webdevcody/go-mailing-list/routes/dashboard/panels/mailer"
)

func RegisterDashboard(app *fiber.App) {
	app.Get("/dashboard", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return c.Redirect("/dashboard/list")
	})
	list.RegisterListPanel(app)
	mailer.RegisterMailerPanel(app)
	bounced.RegisterBouncedPanel(app)
	compose.RegisterComposePanel(app)
}
