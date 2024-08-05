package dataAccess

import (
	"github.com/webdevcody/go-mailing-list/db"
)

type Template struct {
	Id      int64
	Mjml    string
	Html    string
	Text    string
	Subject string
}

func CreateTemplate(mjml string, html string, text string, subject string) (Template, error) {
	db := db.GetDB()
	stmt, err := db.Prepare("INSERT INTO templates (mjml, html, text, subject) VALUES (?, ?, ?, ?) RETURNING id, mjml, html, text, subject")
	if err != nil {
		panic(err)
	}
	defer stmt.Close()

	var createdTemplate Template
	err = stmt.QueryRow(mjml, html, text, subject).Scan(&createdTemplate.Id,
		&createdTemplate.Mjml,
		&createdTemplate.Html,
		&createdTemplate.Text,
		&createdTemplate.Subject)
	if err != nil {
		return Template{}, err
	}

	return createdTemplate, nil
}

func UpdateTemplate(id int64, mjml string, html string, text string, subject string) (Template, error) {
	db := db.GetDB()
	stmt, err := db.Prepare("UPDATE templates SET mjml = ?, html = ?, text = ?, subject = ? WHERE id = ? RETURNING id, mjml, html, text, subject")
	if err != nil {
		panic(err)
	}
	defer stmt.Close()

	var createdTemplate Template
	err = stmt.QueryRow(mjml, html, text, subject, id).Scan(
		&createdTemplate.Id,
		&createdTemplate.Mjml,
		&createdTemplate.Html,
		&createdTemplate.Text,
		&createdTemplate.Subject)
	if err != nil {
		return Template{}, err
	}

	return createdTemplate, nil
}

func DeleteTemplate(templateId int64) error {
	db := db.GetDB()
	stmt, err := db.Prepare("DELETE FROM templates WHERE id = ?")
	if err != nil {
		return err
	}
	_, err = stmt.Exec(templateId)
	if err != nil {
		return err
	}
	return nil
}

func GetTemplate(templateId int64) (Template, error) {
	db := db.GetDB()
	stmt, err := db.Prepare("SELECT * FROM templates WHERE id = ?")
	if err != nil {
		return Template{}, err
	}
	defer stmt.Close()

	var template Template
	err = stmt.QueryRow(templateId).Scan(&template.Id, &template.Mjml, &template.Html, &template.Text, &template.Subject)
	if err != nil {
		return Template{}, err
	}

	return template, nil
}

func GetTemplates() ([]Template, error) {
	db := db.GetDB()
	results, err := db.Query("SELECT * FROM templates")
	if err != nil {
		return nil, err
	}

	var templates []Template
	for results.Next() {
		var template Template
		if err := results.Scan(&template.Id, &template.Mjml, &template.Html, &template.Text, &template.Subject); err != nil {
			return nil, err
		}
		templates = append(templates, template)
	}
	return templates, nil
}
