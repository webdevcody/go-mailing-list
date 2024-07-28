package db

import (
	"database/sql"
	"os"
)

// TODO: get sqlite file from process env
var DATABASE_URL = os.Getenv("DATABASE_URL")

func GetDB() *sql.DB {
	db, err := sql.Open("sqlite", DATABASE_URL)
	if err != nil {
		panic(err)
	}
	return db
}
