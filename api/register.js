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
        const editChoice = params.edit_choice; 
        const confirmChoice = params.confirm_choice; 

        // 1. שלב תעודת זהות - מבנה פשוט שעובד תמיד
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,8,7,Digits,yes");
        }

        // חיפוש ב-Airtable
        let userRecordId = null;
        let existingAge = null;
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        // 2. תפריט בחירה (להשאיר 1 או לשנות 2)
        // שים לב: צמצמתי פסיקים למינימום ההכרחי
        if (existingAge && !editChoice && !userAge) {
            return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל.n-${existingAge}.t-, להשארת הגיל הקישו 1. לשינוי הקישו 2=edit_choice,,1,1,7,NO,yes&user_id=${userId}`);
        }

        // 3. אישור בחירה
        if (editChoice && !confirmChoice && !userAge) {
            const actionText = editChoice === '1' ? `t-להשארת הגיל.` : `t-לשינוי הגיל.`;
            return res.status(200).send(`read=t-בחרת.n-${editChoice}.${actionText}.t- לאישור הקישו 1. לתיקון הקישו 2=confirm_choice,,1,1,7,NO,yes&user_id=${userId}&edit_choice=${editChoice}`);
        }

        // חזרה לתיקון
        if (confirmChoice === '2') {
            return res.status(200).send(`read=t-נא לבחור שוב=edit_choice,,1,1,7,NO,yes&user_id=${userId}`);
        }

        // סיום ללא שינוי
        if (editChoice === '1' && confirmChoice === '1') {
            await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, Action: "Keep_Existing", Details: `ID ${userId} kept age ${existingAge}` });
            return res.status(200).send("id_list_message=t-הגיל נשמר ללא שינוי. תודה ולהתראות&hangup=yes");
        }

        // 4. הקשת גיל
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,1,7,Digits,yes&user_id=${userId}&edit_choice=${editChoice}&confirm_choice=${confirmChoice}`);
        }

        // 5. שמירה סופית
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, Action: "Success", Details: `ID: ${userId} Updated` });

        return res.status(200).send(`id_list_message=t-הנתונים נשמרו בהצלחה. תודה ולהתראות&hangup=yes`);

    } catch (error) {
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
