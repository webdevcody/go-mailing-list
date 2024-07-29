package routes

import (
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/routes/dashboard"
	"github.com/webdevcody/go-mailing-list/routes/login"
	"github.com/webdevcody/go-mailing-list/routes/logout"
	"github.com/webdevcody/go-mailing-list/routes/unsubscribe"
)

func RegisterRoutes(app *fiber.App) {
	dashboard.RegisterDashboard(app)
	login.RegisterLogin(app)
	logout.RegisterLogout(app)
	unsubscribe.RegisterUnsubscribe(app)
}
