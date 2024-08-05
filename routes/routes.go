package routes

import (
	"fmt"

	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/routes/dashboard"
	"github.com/webdevcody/go-mailing-list/routes/login"
	"github.com/webdevcody/go-mailing-list/routes/logout"
	"github.com/webdevcody/go-mailing-list/routes/unsubscribe"
)

func RegisterRoutes(app *fiber.App) {
	app.Post("/api/bounced", auth.ApiAuthMiddleware, func(c *fiber.Ctx) error {
		email := c.FormValue("email")
		fmt.Printf("Marking email as bounced: %s\n", email)
		err := dataAccess.DeleteEmailByEmail(email)
		if err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}
		return c.SendStatus(fiber.StatusOK)
	})

	dashboard.RegisterDashboard(app)
	login.RegisterLogin(app)
	logout.RegisterLogout(app)
	unsubscribe.RegisterUnsubscribe(app)
}
