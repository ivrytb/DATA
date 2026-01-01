const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;

    try {
        const url = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;
        const response = await fetch(url, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const data = await response.json();

        let csv = "\uFEFFתעודת זהות,גיל,טלפון,זמן רישום\n";
        data.records.forEach(r => {
            const f = r.fields;
            csv += `${f.ID || ""},${f.Age || ""},${f.Phone || ""},${r.createdTime}\n`;
        });

        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS } });
        
        await transporter.sendMail({
            from: EMAIL_USER,
            to: EMAIL_USER,
            subject: '📊 דוח נרשמים מלא - לבקשתך',
            text: 'מצורף קובץ האקסל המעודכן מהמערכת.',
            attachments: [{ filename: 'full_report.csv', content: csv }]
        });

        return res.status(200).send("הדוח המלא נשלח למייל שלך.");
    } catch (e) {
        return res.status(500).send("שגיאה בייצוא: " + e.message);
    }
};
