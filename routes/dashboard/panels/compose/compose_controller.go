package compose

import (
	"context"
	"errors"
	"fmt"

	"github.com/Boostport/mjml-go"
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

var convertUrl = "/actions/convert-mjml"

func RegisterComposePanel(app *fiber.App) {
	app.Get("/dashboard/compose", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		return utils.Render(c, composePanel(auth.IsAuthenticated(c)))
	})

	app.Post(convertUrl, auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		input := c.FormValue("mjml")

		output, err := mjml.ToHTML(context.Background(), input, mjml.WithMinify(true))

		var mjmlError mjml.Error

		if errors.As(err, &mjmlError) {
			fmt.Println(mjmlError.Message)
			fmt.Println(mjmlError.Details)
		}

		fmt.Println(output)

		// return utils.Render(c, preview(output))
		return c.SendString(output)
	})
}
