package login

import (
	"errors"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/a-h/templ"
	"github.com/gofiber/fiber/v2"
	"github.com/webdevcody/go-mailing-list/auth"
	"github.com/webdevcody/go-mailing-list/routes/dashboard"
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
		fmt.Println("resetting login attempts")
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
		c.Response().Header.Set("HX-Push-Url", "/dashboard/list")
		c.Response().Header.Set("HX-Retarget", "#content")
		c.Response().Header.Set("HX-Reselect", "#content")
		c.Response().Header.Set("HX-Reswap", "outerHTML")
		return utils.Render(c, dashboard.EmailListPage())
	})

}
