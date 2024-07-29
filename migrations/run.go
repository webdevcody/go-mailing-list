package migrations

import (
	"github.com/webdevcody/go-mailing-list/db"
)

func RunMigrations() {
	db := db.GetDB()
	stmt, err := db.Prepare("CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY, email TEXT)")
	if err != nil {
		panic(err)
	}
	stmt.Exec()

	// add a unique constraint to the email column if it does not exists
	stmt, err = db.Prepare("CREATE UNIQUE INDEX IF NOT EXISTS email_unique ON emails (email)")
	if err != nil {
		panic(err)
	}
	stmt.Exec()
}
