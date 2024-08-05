package compose

import (
	"context"
	"errors"
	"fmt"
	"strconv"

	"github.com/k3a/html2text"

	"github.com/Boostport/mjml-go"
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
	"github.com/webdevcody/go-mailing-list/services"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

var convertUrl = "/actions/convert-mjml"
var saveTemplateUrl = "/actions/save-template"
var deleteTemplateUrl = "/actions/delete-template"
var createTemplateUrl = "/actions/create-template"
var sendEmailsUrl = "/actions/send-emails-from-template"
var sendTestEmailUrl = "/actions/send-test-email"

func RegisterComposePanel(app *fiber.App) {
	app.Get("/dashboard/compose", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		templates, err := dataAccess.GetTemplates()
		if err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}
		return utils.Render(c, templatesPage(auth.IsAuthenticated(c), templates))
	})

	app.Get("/dashboard/compose/:templateId", auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		templateIdStr := c.Params("templateId")
		templateId, err := strconv.ParseInt(templateIdStr, 10, 64)
		if err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}
		template, err := dataAccess.GetTemplate(templateId)
		if err != nil {
			return c.SendStatus(fiber.StatusBadRequest)
		}
		return utils.Render(c, composePanel(auth.IsAuthenticated(c), template))
	})

	app.Post(createTemplateUrl, auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		newTemplate, err := dataAccess.CreateTemplate(
			`<mjml>
  <mj-body>
    <mj-section>
      <mj-column>

        <mj-image width="100px" src="/assets/img/logo-small.png"></mj-image>

        <mj-divider border-color="#F45E43"></mj-divider>

        <mj-text font-size="20px" color="#F45E43" font-family="helvetica">Hello World</mj-text>

      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`,
			"HTML",
			"TEXT",
			"This is your email subject")
		if err != nil {
			fmt.Println(err)
			return c.SendStatus(fiber.StatusBadRequest)
		}

		c.Response().Header.Set("HX-Redirect", "/dashboard/compose/"+strconv.FormatInt(newTemplate.Id, 10))
		return c.SendStatus(fiber.StatusCreated)
	})

	app.Post(saveTemplateUrl, auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		templateIdStr := c.FormValue("templateId")
		mjml := c.FormValue("mjml")
		html := c.FormValue("html")
		text := c.FormValue("text")
		subject := c.FormValue("subject")

		fmt.Println(text)

		templateId, err := strconv.ParseInt(templateIdStr, 10, 64)
		if err != nil {
			fmt.Println(err)
			return c.SendStatus(fiber.StatusBadRequest)
		}
		_, err = dataAccess.UpdateTemplate(templateId, mjml, html, text, subject)
		if err != nil {
			fmt.Println(err)
			return c.SendStatus(fiber.StatusBadRequest)
		}

		return c.SendStatus(fiber.StatusOK)
	})

	app.Post(convertUrl, auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		input := c.FormValue("mjml")

		html, err := mjml.ToHTML(context.Background(), input, mjml.WithMinify(true))

		var mjmlError mjml.Error

		if errors.As(err, &mjmlError) {
			fmt.Println(mjmlError.Message)
			fmt.Println(mjmlError.Details)
		}

		plain := html2text.HTML2Text(html)

		return utils.Render(c, convertResponse(html, plain))
	})

	app.Delete(deleteTemplateUrl, auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		templateIdStr := c.FormValue("templateId")
		templateId, err := strconv.ParseInt(templateIdStr, 10, 64)
		if err != nil {
			fmt.Println(err)
			return c.SendStatus(fiber.StatusBadRequest)
		}

		err = dataAccess.DeleteTemplate(templateId)
		if err != nil {
			fmt.Println(err)
			return c.SendStatus(fiber.StatusBadRequest)
		}

		c.Response().Header.Set("HX-Redirect", "/dashboard/compose")
		return c.SendStatus(fiber.StatusNoContent)
	})

	app.Post(sendEmailsUrl, auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		subject := c.FormValue("subject")
		html := c.FormValue("html")
		text := c.FormValue("text")

		services.SendEmails(subject, html, text, "")

		c.Response().Header.Set("HX-Redirect", "/dashboard/compose")
		return c.SendStatus(fiber.StatusOK)
	})

	app.Post(sendTestEmailUrl, auth.AssertAuthenticatedMiddleware, func(c *fiber.Ctx) error {
		subject := c.FormValue("subject")
		html := c.FormValue("html")
		text := c.FormValue("text")
		tester := c.Get("Hx-Prompt")

		if tester == "" {
			return c.SendStatus(fiber.StatusBadRequest)
		}

		services.SendEmails(subject, html, text, tester)

		c.Response().Header.Set("HX-Redirect", "/dashboard/compose")
		return c.SendStatus(fiber.StatusOK)
	})
}
