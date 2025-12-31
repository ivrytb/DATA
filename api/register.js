module.exports = async (req, res) => {
    // 1. הגדרות בסיסיות (נשתמש בערך ברירת מחדל כדי למנוע קריסה אם המשתנה חסר)
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';
    const LOG_TABLE = 'Logs';

    try {
        // 2. חילוץ פרמטרים בצורה בטוחה
        const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
        const params = Object.fromEntries(searchParams);
        
        // מיזוג נתונים שנשלחו ב-POST (במידה ויש)
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;
        const phone = params.ApiPhone || '000';
        const editMode = params.edit_mode;

        // --- שלב א: בקשת תעודת זהות ---
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // --- שלב ב: חיפוש ב-Airtable (רק אם יש ת"ז ואין עדיין גיל) ---
        if (userId && !userAge && !editMode) {
            const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
            const searchRes = await fetch(searchUrl, { 
                headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } 
            });
            const searchData = await searchRes.json();
            const userRecord = searchData.records && searchData.records.length > 0 ? searchData.records[0] : null;

            // אם נמצא משתמש קיים
            if (userRecord && userRecord.fields.Age) {
                const age = userRecord.fields.Age;
                return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל .n-${age}. לעדכון הגיל הקישו 1. ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
            }
        }

        // --- שלב ג: בקשת גיל (למשתמש חדש או מי שביקש לעדכן) ---
        if (!userAge && editMode !== '') {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // --- שלב ד: סיום ושמירה ---
        if (userId && userAge !== undefined) {
            // שמירה ב-Airtable (ללא await כדי לסיים את השיחה מהר)
            upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge });
            
            // רישום לוג
            upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, Action: "Success", Details: `ID: ${userId}, Age: ${userAge}` });

            return res.status(200).send(`id_list_message=t-הנתונים נקלטו בהצלחה. תודה ולהתראות&hangup=yes`);
        }

        // מקרה קצה - אם הגענו לכאן בלי נתונים
        return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");

    } catch (error) {
        console.error("Critical Error:", error);
        // במקרה של שגיאה, נחזיר הודעה לימות המשיח כדי שלא ינתקו סתם
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת הרישום&hangup=yes");
    }
};

// פונקציה גנרית לשמירה/עדכון
async function upsertData(token, baseId, tableName, data) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    const fields = {};
    if (data.userId) fields["ID"] = String(data.userId);
    if (data.userAge) fields["Age"] = String(data.userAge);
    if (data.phone) fields["Phone"] = String(data.phone);
    if (data.Action) fields["Action"] = data.Action;
    if (data.Details) fields["Details"] = data.Details;

    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ records: [{ fields }] })
        });
    } catch (e) {
        console.error("Airtable Error:", e);
    }
}
