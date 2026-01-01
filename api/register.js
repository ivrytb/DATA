const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';
    const LOG_TABLE = 'Logs';
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    try {
        const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const params = Object.fromEntries(searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id ? String(params.user_id).trim() : null;
        const userAge = params.user_age ? String(params.user_age).trim() : null;
        const phone = (params.ApiPhone || '000').trim();
        const editMode = params.edit_mode;

        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        let userRecordId = null;
        let existingAge = null;

        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        if (!userRecordId) {
            const createRes = await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge: "בתהליך רישום" });
            const newData = await createRes.json();
            userRecordId = newData.id; 
        }

        if (existingAge && existingAge !== "בתהליך רישום" && !userAge && !editMode) {
            return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל.n-${existingAge}.t-לעדכון הגיל הקישו 1.t-ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        if (editMode === '') return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");

        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        
        // שליחת מייל מיידי על הפעולה הנוכחית
        sendSingleNotification(EMAIL_USER, EMAIL_PASS, { userId, userAge, phone, isUpdate: !!existingAge });

        upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Success", Details: `ID: ${userId} Age: ${userAge}` 
        });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נרשמו בהצלחה&hangup=yes`);

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה&hangup=yes");
    }
};

async function sendSingleNotification(user, pass, info) {
    try {
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
        await transporter.sendMail({
            from: user,
            to: user,
            subject: `✅ ${info.isUpdate ? 'עדכון' : 'רישום'} חדש: ${info.userId}`,
            html: `<b>ת"ז:</b> ${info.userId}<br><b>גיל:</b> ${info.userAge}<br><b>טלפון:</b> ${info.phone}`
        });
    } catch (e) { console.error(e); }
}

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
