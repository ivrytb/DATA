const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';

    try {
        const airtableUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
        const response = await fetch(airtableUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const data = await response.json();

        let csvContent = "\uFEFF תעודת זהות,גיל,טלפון,זמן רישום\n";
        data.records.forEach(r => {
            const f = r.fields;
            csvContent += `${f.ID || ""},${f.Age || ""},${f.Phone || ""},${r.createdTime || ""}\n`;
        });

        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });

        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: '📊 דוח נרשמים מעודכן',
            text: 'מצורף קובץ האקסל.',
            attachments: [{ filename: 'report.csv', content: csvContent }]
        });

        return res.status(200).send("נשלח בהצלחה!");
    } catch (e) {
        return res.status(500).send(e.message);
    }
};
