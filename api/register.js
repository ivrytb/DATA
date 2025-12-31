module.exports = async (req, res) => {
    try {
        // שימוש במשתני הסביבה שהגדרת בורסל
        const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
        const BASE_ID = process.env.BASE_ID;
        const TABLE_NAME = 'Table 1'; // אפשר להפוך גם את זה למשתנה סביבה אם תרצה

        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
        const params = Object.fromEntries(fullUrl.searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;
        const phone = params.ApiPhone || '000';

        // שלב 1: בקשת תעודת זהות (הפעולה הראשונה)
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב 2: חיפוש המשתמש ב-Airtable רק אחרי שיש לנו ת"ז
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        const userRecord = searchData.records && searchData.records[0];

        // אם המשתמש כבר קיים ויש לו גיל רשום
        if (userRecord && userRecord.fields.Age && !userAge && !params.edit_mode) {
             const existingAge = userRecord.fields.Age;
             return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל .n-${existingAge}. לעדכון הגיל הקישו 1. ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        // יציאה אם המשתמש הקיש סולמית בשינוי גיל
        if (params.edit_mode === '') {
            return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");
        }

        // שלב 3: בקשת גיל (לחדש או למעדכן)
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית. לדילוג הקישו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שלב 4: שמירה אסינכרונית ב-Airtable (מהיר מאוד)
        upsertToAirtable(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, {
            phone,
            userId,
            userAge: userAge || "דילג"
        }, userRecord?.id);

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.נרשמו בהצלחה&hangup=yes`);

    } catch (error) {
        console.error("Critical Error:", error);
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת הרישום&hangup=yes");
    }
};

function upsertToAirtable(token, baseId, tableName, data, recordId) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? '/' + recordId : ''}`;
    const method = recordId ? 'PATCH' : 'POST';
    
    const body = recordId ? 
        { fields: { "Age": data.userAge, "Phone": data.phone } } : 
        { records: [{ fields: { "ID": data.userId, "Age": data.userAge, "Phone": data.phone } }] };

    fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }).catch(err => console.error("Airtable Save Error:", err));
}
