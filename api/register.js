module.exports = async (req, res) => {
    const { AIRTABLE_TOKEN, BASE_ID } = process.env;
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
        const editChoice = params.edit_choice; // 1 = להשאיר, 2 = לשנות
        const confirmChoice = params.confirm_choice; // 1 = אישור, 2 = תיקון

        // שלב 1: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-אנא הקישו את תעודת הזהות שלכם=user_id,,9,9,Digits,yes");
        }

        // חיפוש משתמש
        let userRecordId = null;
        let existingAge = null;
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        // שלב 2: תפריט בחירה למשתמש קיים
        if (existingAge && !editChoice && !userAge) {
            return res.status(200).send(`read=t-תעודת זהות זו כבר רשומה, הגיל הוא.n-${existingAge}.t-להשארת הגיל ללא שינוי, הקישו 1.t-לשינוי הקישו 2=edit_choice,,1,1,7,NO,yes,yes,,12,3,Ok,,,no&user_id=${userId}`);
        }

        // שלב 3: אישור הבחירה
        if (editChoice && !confirmChoice && !userAge) {
            const text = editChoice === '1' ? `t-בחרת להשאיר את הגיל הקיים.` : `t-בחרת לשנות את הגיל.`;
            // הגבלת מקשים ל-1 ו-2 בלבד
            return res.status(200).send(`read=${text}t-לאישור הקישו 1.t-לתיקון הבחירה הקישו 2=confirm_choice,,1,1,1-2,yes&user_id=${userId}&edit_choice=${editChoice}`);
        }

        // חזרה לתפריט קודם אם בחר "תיקון"
        if (confirmChoice === '2') {
            return res.status(200).send(`read=t-נא לבחור שוב=edit_choice,,1,1,1-2,yes&user_id=${userId}`);
        }

        // שלב 4: טיפול בבחירה "להשאיר" (אישור סופי)
        if (editChoice === '1' && confirmChoice === '1') {
            await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
                phone, Action: "Keep_Existing", Details: `User ID ${userId} kept age ${existingAge}` 
            });
            // הודעה ברורה לפני ניתוק
            return res.status(200).send("id_list_message=t-הגיל נשמר ללא שינוי. תודה ולהתראות&hangup=yes");
        }

        // שלב 5: בקשת גיל (למשתמש חדש או למי שבחר לשנות)
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}&edit_choice=${editChoice}&confirm_choice=${confirmChoice}`);
        }

        // שלב 6: שמירה סופית
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Success", Details: `ID: ${userId} Registered/Updated with age ${userAge}` 
        });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נשמרו בהצלחה. תודה ולהתראות&hangup=yes`);

    } catch (error) {
        // לוג שגיאות ל-Airtable
        try {
            await upsertData(process.env.AIRTABLE_TOKEN, process.env.BASE_ID, LOG_TABLE, { 
                phone: "ERROR", Action: "System_Error", Details: error.message 
            });
        } catch (e) {}
        
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת. נא לנסות שוב מאוחר יותר&hangup=yes");
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
