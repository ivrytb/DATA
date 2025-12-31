module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
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

        // שלב א: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב ב: חיפוש משתמש
        let userRecordId = null;
        let existingAge = null;

        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        // --- חידוש: שמירה ראשונית של הת"ז (גם אם ינתק עכשיו, המידע קיים) ---
        if (!userRecordId) {
            // יוצר שורה חדשה רק עם ת"ז וטלפון (בלי להמתין - אסינכרוני)
            const createRes = await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge: "בתהליך רישום" });
            const newData = await createRes.json();
            userRecordId = newData.id; 
        }

        // תפריט עריכה למשתמש קיים
        if (existingAge && !userAge && !editMode) {
            return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל.n-${existingAge}.t-לעדכון הגיל הקישו 1.t-ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        if (editMode === '') return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");

        // שלב ג: בקשת גיל
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שלב ד: עדכון סופי של הגיל
        // כאן אנחנו עושים await כדי לוודא שזה נרשם לפני סיום
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        
        // לוג הצלחה (אסינכרוני - לא מעכב)
        upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Success", Details: `ID: ${userId} Registered` 
        });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נרשמו בהצלחה&hangup=yes`);

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה&hangup=yes");
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
