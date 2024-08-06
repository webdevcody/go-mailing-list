package migrations

import (
	"github.com/webdevcody/go-mailing-list/db"
)

func Up(key string, upFun func()) {
	db := db.GetDB()
	stmt, err := db.Prepare("SELECT key FROM migrations WHERE key = ?")
	if err != nil {
		panic(err)
	}
	defer stmt.Close()

	var foundKey string
	err = stmt.QueryRow(key).Scan(&foundKey)
	if err != nil {
		if err.Error() == "sql: no rows in result set" {
			upFun()
			stmt, err = db.Prepare("INSERT INTO migrations (key) VALUES (?)")
			if err != nil {
				panic(err)
			}
			defer stmt.Close()
			_, err = stmt.Exec(key)
			if err != nil {
				panic(err)
			}
		} else {
			panic(err)
		}
	}

}

func RunMigrations() {
	db := db.GetDB()
	stmt, err := db.Prepare("CREATE TABLE IF NOT EXISTS migrations (key TEXT PRIMARY KEY, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)")
	if err != nil {
		panic(err)
	}
	stmt.Exec()

	Up("create-tables", func() {
		stmt, err = db.Prepare("CREATE TABLE IF NOT EXISTS emails (id INTEGER PRIMARY KEY, email TEXT)")
		if err != nil {
			panic(err)
		}
		stmt.Exec()

		stmt, err = db.Prepare("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, sessionId TEXT)")
		if err != nil {
			panic(err)
		}
		stmt.Exec()

		stmt, err = db.Prepare("CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY, mjml TEXT, html TEXT, text TEXT, subject TEXT)")
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
	})

	Up("add-unsubscribe-id", func() {
		stmt, err = db.Prepare("ALTER TABLE emails ADD COLUMN unsubscribeId TEXT")
		if err != nil {
			panic(err)
		}
		_, err = stmt.Exec()
		if err != nil {
			panic(err)
		}

		stmt, err = db.Prepare("UPDATE emails SET unsubscribeId = lower(hex(randomblob(32))) WHERE unsubscribeId IS NULL")
		if err != nil {
			panic(err)
		}
		_, err = stmt.Exec()
		if err != nil {
			panic(err)
		}
	})

}
