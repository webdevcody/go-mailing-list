package dashboard

import (
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	"github.com/webdevcody/go-mailing-list/routes/dashboard/panels/compose"
	"github.com/webdevcody/go-mailing-list/routes/dashboard/panels/list"
)

func RegisterDashboard(app *fiber.App) {
	app.Get("/dashboard", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return c.Redirect("/dashboard/list")
	})
	list.RegisterListPanel(app)
	compose.RegisterComposePanel(app)
}
