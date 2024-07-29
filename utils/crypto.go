package utils

import (
	"github.com/google/uuid"
)

func GetRandomUuid() string {
	uuid := uuid.New()
	return uuid.String()
}
