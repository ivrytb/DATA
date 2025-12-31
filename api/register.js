module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';
    const LOG_TABLE = 'Logs';

    try {
        const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const params = Object.fromEntries(searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;
        const phone = params.ApiPhone || '000';
        const editMode = params.edit_mode;

        // שלב א: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב ב: חיפוש משתמש ב-Airtable
        let userRecordId = null;
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        const foundRecord = searchData.records && searchData.records[0];

        if (foundRecord) {
            userRecordId = foundRecord.id;
            // אם המשתמש קיים ויש לו גיל, ועדיין לא בחרנו לערוך
            if (foundRecord.fields.Age && !userAge && !editMode) {
                const age = foundRecord.fields.Age;
                // שימוש בנקודה כמפריד בין סוגי נתונים: t ל-n וכו'
                return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל.n-${age}.t-לעדכון הגיל הקישו 1.t-ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
            }
        }

        // יציאה
        if (editMode === '') return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");

        // שלב ג: בקשת גיל
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שלב ד: שמירה סופית (עם await לוודא כתיבה לפני סיום)
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        
        // לוג הצלחה
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, Action: "Success", Details: `ID: ${userId} Age: ${userAge}` });

        // הודעת סיום עם פורמט נקודות תקני
        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נרשמו בהצלחה.t-תודה ולהתראות&hangup=yes`);

    } catch (error) {
        console.error("Global Error:", error);
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת הרישום&hangup=yes");
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

    const body = recordId ? { fields } : { records: [{ fields }] };

    const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}
