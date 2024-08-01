package login

import (
	"net/http"

	"github.com/a-h/templ"
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	"github.com/webdevcody/go-mailing-list/routes/dashboard"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

var loginActionUrl = "/actions/login"

func RegisterLogin(app *fiber.App) {
	app.Get("/login", func(c *fiber.Ctx) error {
		if auth.IsAuthenticated(c) {
			return c.Redirect("/dashboard")
		}
		return utils.Render(c, login(auth.IsAuthenticated(c)))
	})

	app.Post(loginActionUrl, func(c *fiber.Ctx) error {
		password := c.FormValue("password")
		isValid := auth.IsValidPassword(password)
		if !isValid {
			return utils.Render(c, InvalidPasswordError(), templ.WithStatus(http.StatusUnprocessableEntity))
		}
		auth.SetSession(c)
		c.Response().Header.Set("HX-Push-Url", "/dashboard/list")
		c.Response().Header.Set("HX-Retarget", "#content")
		c.Response().Header.Set("HX-Reselect", "#content")
		c.Response().Header.Set("HX-Reswap", "outerHTML")
		return utils.Render(c, dashboard.EmailListPage())
		// c.Response().Header.Set("HX-Redirect", "/dashboard/list")
		// return c.SendStatus(http.StatusOK)
	})

}
