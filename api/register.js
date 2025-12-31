module.exports = async (req, res) => {
    const AIRTABLE_TOKEN = process.env.AIRTABLE_TOKEN;
    const BASE_ID = process.env.BASE_ID;
    const TABLE_NAME = 'Table 1';
    const LOG_TABLE = 'Logs'; // שם הטבלה החדשה

    try {
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
        const params = Object.fromEntries(fullUrl.searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;
        const phone = params.ApiPhone || 'unknown';

        // פונקציית עזר פנימית לרישום לוג מהיר
        const log = (action, details) => {
            writeLog(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, action, details: JSON.stringify(details) });
        };

        // לוג כניסה למערכת
        if (!userId && !params.edit_mode) {
            log("Entry", "User reached the start of registration");
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // חיפוש ב-Airtable
        let userRecord = null;
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        userRecord = searchData.records && searchData.records[0];

        // לוג זיהוי משתמש
        if (userId && !userAge && !params.edit_mode) {
            log("Search", { userId, found: !!userRecord });
        }

        // תפריט משתמש קיים
        if (userRecord && userRecord.fields.Age && !userAge && !params.edit_mode) {
             const existingAge = userRecord.fields.Age;
             return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל .n-${existingAge}. לעדכון הגיל הקישו 1. ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        // יציאה
        if (params.edit_mode === '') {
            log("Exit", "User chose to exit");
            return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");
        }

        // בקשת גיל
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית. לדילוג הקישו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שמירה סופית ולוג הצלחה
        upsertToAirtable(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, {
            phone,
            userId,
            userAge: userAge || "דילג"
        }, userRecord?.id);

        log("Success", { userId, userAge: userAge || "skipped" });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.נשמרו בהצלחה&hangup=yes`);

    } catch (error) {
        // לוג שגיאה קריטית
        writeLog(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone: req.query.ApiPhone || 'unknown', 
            action: "ERROR", 
            details: error.message 
        });
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת&hangup=yes");
    }
};

// פונקציית שמירת לוגים אסינכרונית (לא מעכבת את המשתמש)
function writeLog(token, baseId, tableName, data) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;
    fetch(url, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: [{ fields: { "Phone": data.phone, "Action": data.action, "Details": data.details } }] })
    }).catch(e => console.error("Logging to Airtable failed", e));
}

// פונקציית העדכון המוכרת
function upsertToAirtable(token, baseId, tableName, data, recordId) {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}${recordId ? '/' + recordId : ''}`;
    const method = recordId ? 'PATCH' : 'POST';
    const fields = { "Age": String(data.userAge), "Phone": String(data.phone) };
    if (!recordId) fields["ID"] = String(data.userId);

    fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(recordId ? { fields } : { records: [{ fields }] })
    }).catch(err => console.error("Airtable Update Error:", err));
}
