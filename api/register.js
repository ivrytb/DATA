module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';
    const LOG_TABLE = 'Logs';

    try {
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
        const params = Object.fromEntries(fullUrl.searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;
        const phone = params.ApiPhone || 'unknown';

        // פונקציית לוג
        const log = (action, details) => {
            fetch(`https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(LOG_TABLE)}`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ records: [{ fields: { "Phone": phone, "Action": action, "Details": JSON.stringify(details) } }] })
            }).catch(() => {});
        };

        // שלב 1: אם עוד לא הוקשה תעודת זהות - בקש אותה
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב 2: המאזין הקיש ת"ז. עכשיו הקוד רץ (המאזין ממתין על הקו)
        let userRecord = null;
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        userRecord = searchData.records && searchData.records[0];

        // בדיקה אם המשתמש קיים וצריך להציע לו עריכה
        if (userRecord && userRecord.fields.Age && !userAge && !params.edit_mode) {
             const existingAge = userRecord.fields.Age;
             return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל .n-${existingAge}. לעדכון הגיל הקישו 1. ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        // אם המשתמש בחר לצאת
        if (params.edit_mode === '') {
            return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");
        }

        // שלב 3: אם הוא לא קיים או שהוא ביקש לעדכן - מבקשים גיל
        // חשוב: אנחנו מחזירים הוראת read. ימות המשיח יבצעו אותה ויחזרו אלינו עם הגיל.
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית. לדילוג הקישו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שלב 4: המאזין הקיש גיל. עכשיו שומרים הכל ב-Airtable
        // משתמשים ב-await כאן כדי לוודא שזה נשמר לפני שמאשרים לו
        await upsertToAirtable(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, {
            phone,
            userId,
            userAge: userAge || "דילג"
        }, userRecord?.id);

        log("Final_Save", { userId, userAge });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.נרשמו בהצלחה&hangup=yes`);

    } catch (error) {
        return res.status(200).send("id_list_message=t-שגיאה כללית&hangup=yes");
    }
};

async function upsertToAirtable(token, baseId, tableName, data, recordId) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? '/' + recordId : ''}`;
    const method = recordId ? 'PATCH' : 'POST';
    const fields = { "Age": String(data.userAge), "Phone": String(data.phone) };
    if (!recordId) fields["ID"] = String(data.userId);

    return fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(recordId ? { fields } : { records: [{ fields }] })
    });
}
