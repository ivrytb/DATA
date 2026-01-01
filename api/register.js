const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    const { AIRTABLE_TOKEN, BASE_ID, EMAIL_USER, EMAIL_PASS } = process.env;
    const TABLE_NAME = 'Table 1';
    const LOG_TABLE = 'Logs';

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    try {
        const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const params = Object.fromEntries(searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id ? String(params.user_id).trim() : null;
        const userAge = params.user_age ? String(params.user_age).trim() : null;
        const phone = (params.ApiPhone || '000').trim();

        // שלב 1: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // --- לוג: ניסיון חיפוש ---
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Search_Attempt", Details: `Searching for ID: ${userId}` 
        });

        // שלב 2: חיפוש משתמש ב-Airtable (כדי למנוע כפילויות)
        let userRecordId = null;
        let existingAge = null;

        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id; // מצאנו משתמש קיים
            existingAge = searchData.records[0].fields.Age;
        }

        // שלב 3: בקשת גיל (אם עדיין אין לנו גיל בפרמטרים)
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שלב 4: עדכון או יצירה (Upsert)
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);

        // שלב 5: שליחת מייל עדכון
        try {
            const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: EMAIL_USER, pass: EMAIL_PASS } });
            await transporter.sendMail({
                from: EMAIL_USER,
                to: EMAIL_USER,
                subject: `✅ ${userRecordId ? 'עדכון' : 'רישום'} חדש: ${userId}`,
                text: `בוצע ${userRecordId ? 'עדכון' : 'רישום'}:\nת"ז: ${userId}\nגיל: ${userAge}\nטלפון: ${phone}`
            });
        } catch (mailErr) {
            console.error("Mail Error:", mailErr.message);
        }

        // לוג הצלחה סופי
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Success", Details: `ID: ${userId} Registered with age ${userAge}` 
        });

        return res.status(200).send(`id_list_message=t-הנתונים נשמרו בהצלחה&hangup=yes`);

    } catch (error) {
        console.error("Global Error:", error.message);
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת&hangup=yes");
    }
};

async function upsertData(token, baseId, tableName, data, recordId) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? '/' + recordId : ''}`;
    const method = recordId ? 'PATCH' : 'POST';
    const fields = {};
    if (data.userId) fields["ID"] = String(data.userId);
    if (data.userAge) fields["Age"] = String(data.userAge);
    if (data.phone) fields["Phone"] = String(data.phone);
    if (data.Action) fields["Action"] = data.Action;
    if (data.Details) fields["Details"] = data.Details;

    return fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(recordId ? { fields } : { records: [{ fields }] })
    });
}
