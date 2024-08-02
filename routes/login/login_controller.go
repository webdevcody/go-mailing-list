package login

import (
	"errors"
	"net/http"
	"sync"
	"time"

	"github.com/a-h/templ"
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	"github.com/webdevcody/go-mailing-list/utils"

	_ "github.com/mattn/go-sqlite3"
)

var (
	maxLoginAttempts = 5
	loginAttempts    = 0
	mu               sync.Mutex
	resetAt          int64 = 0
	loginActionUrl         = "/actions/login"
)

func assertUnderRateLimit() error {
	mu.Lock()
	defer mu.Unlock()

	now := time.Now().Unix()
	if now > resetAt {
		resetAt = now + 1
		loginAttempts = 0
	}

	if loginAttempts > maxLoginAttempts {
		return errors.New("too many login attempts")
	}

	loginAttempts++
	return nil
}

func RegisterLogin(app *fiber.App) {
	app.Get("/login", func(c *fiber.Ctx) error {
		return utils.Render(c, login(auth.IsAuthenticated(c)))
	})

	app.Post(loginActionUrl, func(c *fiber.Ctx) error {
		if err := assertUnderRateLimit(); err != nil {
			return c.SendStatus(fiber.StatusTooManyRequests)
		}
		password := c.FormValue("password")
		isValid := auth.IsValidPassword(password)
		if !isValid {
			return utils.Render(c, InvalidPasswordError(), templ.WithStatus(http.StatusUnprocessableEntity))
		}
		auth.SetSession(c)
		c.Response().Header.Set("HX-Redirect", "/dashboard/list")
		return c.SendStatus(fiber.StatusOK)
	})

}
