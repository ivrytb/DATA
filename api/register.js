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
        const editMode = params.edit_mode;

        // שלב 1: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב 2: חיפוש משתמש קיים
        let userRecordId = null;
        let existingAge = null;

        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        // --- לוג ניסיון חיפוש ---
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Search_Attempt", Details: `ID: ${userId} (Found: ${!!userRecordId})` 
        });

        // שלב 3: תפריט עריכה (רק אם המשתמש קיים ויש לו גיל, ועדיין לא הקיש גיל חדש)
        if (existingAge && !userAge && !editMode) {
            return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל.n-${existingAge}.t-לעדכון הקישו 1.t-ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        // אם המשתמש בחר לצאת (הקיש סולמית או לא הקיש 1)
        if (editMode === '') {
            return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");
        }

        // שלב 4: בקשת גיל (אם חדש או אם בחר לעדכן)
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שלב 5: עדכון סופי ב-Airtable
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);

        // שלב 6: שליחת מייל - הועבר לפני סיום הפעולה
        try {
            const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: { user: EMAIL_USER, pass: EMAIL_PASS }
            });

            // בדיקת חיבור (רק בשביל הלוג)
            await transporter.verify();

            await transporter.sendMail({
                from: `"מערכת רישום" <${EMAIL_USER}>`,
                to: EMAIL_USER,
                subject: `🔔 ${userRecordId ? 'עדכון' : 'רישום'} חדש: ${userId}`,
                text: `בוצע ${userRecordId ? 'עדכון' : 'רישום'}:\nת"ז: ${userId}\nגיל: ${userAge}\nטלפון: ${phone}`
            });
            console.log("Email sent successfully!");
        } catch (mErr) {
            // כאן זה יכתוב ללוג של ורסל בדיוק מה הבעיה
            console.error("Critical Mail Error:", mErr.message);
        }

        // לוג הצלחה ב-Airtable
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Success", Details: `ID: ${userId} Registered with age ${userAge}` 
        });

        // רק עכשיו מחזירים תשובה לימות המשיח
        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נשמרו בהצלחה&hangup=yes`);
        
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
