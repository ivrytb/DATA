module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';
    const LOG_TABLE = 'Logs';

    // מניעת שמירה בזיכרון (Cache) - חשוב מאוד לימות המשיח
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

    try {
        const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const params = Object.fromEntries(searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;
        const phone = params.ApiPhone || '000';
        const editMode = params.edit_mode;

        // שלב 1: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב 2: חיפוש משתמש קיים לפי ת"ז
        let userRecordId = null;
        let existingAge = null;

        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        
        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        // אם המשתמש קיים ויש לו גיל, ועדיין לא בחרנו לערוך
        if (userRecordId && existingAge && !userAge && !editMode) {
            return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל.n-${existingAge}.t-לעדכון הגיל הקישו 1.t-ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        // יציאה
        if (editMode === '') {
            return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");
        }

        // שלב 3: בקשת גיל (לחדש או למעדכן)
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שלב 4: שמירה/עדכון בטבלה הראשית
        // אם מצאנו userRecordId - זה יבצע PATCH (עדכון). אם לא - POST (חדש).
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        
        // שמירת לוג (תמיד שורה חדשה בטבלת לוגים)
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, Action: "Success", Details: `ID: ${userId} Age: ${userAge} Mode: ${userRecordId ? 'Update' : 'New'}` });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נרשמו בהצלחה.t-תודה ולהתראות&hangup=yes`);

    } catch (error) {
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
