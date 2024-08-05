package auth

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
	dataAccess "github.com/webdevcody/go-mailing-list/data-access"
)

const sessionIdLength = 32

func ApiAuthMiddleware(c *fiber.Ctx) error {
	if !IsAuthenticated(c) {
		return c.SendStatus(fiber.StatusUnauthorized)
	}
	return c.Next()
}

func AssertAuthenticatedMiddleware(c *fiber.Ctx) error {
	if !IsAuthenticated(c) {
		c.Set("HX-Redirect", "/login")
		return c.Redirect("/login")
	}
	return c.Next()
}

func IsAuthenticated(c *fiber.Ctx) bool {
	authHeader := c.Get("Authorization")
	if authHeader != "" {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		return IsValidPassword(token)
	}

	userSessionId := GetUserSessionId(c)
	_, err := dataAccess.GetSession(userSessionId)
	return err == nil
}

func GetUserSessionId(c *fiber.Ctx) string {
	return c.Cookies("session")
}

func SetSession(c *fiber.Ctx) string {
	newSessionId := generateSessionId()
	dataAccess.CreateSession(newSessionId)
	c.Cookie(&fiber.Cookie{
		Name:     "session",
		Value:    newSessionId,
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})
	return newSessionId
}

func ClearSession(c *fiber.Ctx) {
	dataAccess.DeleteAllSessions()
	c.Cookie(&fiber.Cookie{
		Name:     "session",
		Value:    "",
		HTTPOnly: true,
		Secure:   true,
		SameSite: "Strict",
	})
}

func generateSessionId() string {
	bytes := make([]byte, sessionIdLength)
	if _, err := rand.Read(bytes); err != nil {
		panic(err)
	}
	return hex.EncodeToString(bytes)
}

func IsValidPassword(password string) bool {
	expectedPassword := os.Getenv("PASSWORD")
	return subtle.ConstantTimeCompare([]byte(password), []byte(expectedPassword)) == 1
}
