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

        // 1. תעודת זהות - שומעים את ההקשה לווידוא
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,8,7,TeudatZehut,yes");
        }

        let userRecordId = null;
        let existingAge = null;
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();

        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        // 2. תפריט בחירה - ערך 6 הוא NO (לא רוצים לשמוע "אחת" או "שתים")
        if (existingAge && !editChoice && !userAge) {
            return res.status(200).send(`read=t-תעודת זהות זו כבר רשומה במערכת. המערכת מזהה שהגיל הוא.n-${existingAge}.t-, להשארת הגיל ללא שינוי הקישו.n-1.t-, לשינוי הגיל הקישו.n-2=edit_choice,yes,1,1,7,NO,no,no,,12,3,Ok,,,no&user_id=${userId}`);
        }

        // 3. אישור בחירה - ערך 6 הוא NO
        if (editChoice && !confirmChoice && !userAge) {
            const actionText = editChoice === '1' ? `t-להשארת הגיל הקיים.` : `t-לשינוי הגיל.`;
            return res.status(200).send(`read=t-בחרת.n-${editChoice}.${actionText}.t- לאישור הבחירה הקישו.n-1.t-. לתיקון ובחירה מחדש הקישו.n-2=confirm_choice,yes,1,1,7,NO,no,no,,12,3,Ok,,,no&user_id=${userId}&edit_choice=${editChoice}`);
        }

        if (confirmChoice === '2') {
            return res.status(200).send(`read=t-נא לבחור שוב. להשארת הגיל הקישו.n-1.t-. לשינוי הקישו.n-2=edit_choice,yes,1,1,7,NO,no,no,,12,3,Ok,,,no&user_id=${userId}`);
        }

        // סיום ללא שינוי
        if (editChoice === '1' && confirmChoice === '1') {
            await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, Action: "Keep_Existing", Details: `ID ${userId} kept age ${existingAge}` });
            return res.status(200).send("id_list_message=t-הגיל נשמר ללא שינוי. תודה ולהתראות&hangup=yes");
        }

        // 4. הקשת גיל - ערך 6 הוא Digits (כן רוצים לוודא מה הוקש)
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש את הגיל המעודכן ובסיומו סולמית=user_age,yes,3,1,7,Digits,no,no,,,,,no&user_id=${userId}&edit_choice=${editChoice}&confirm_choice=${confirmChoice}`);
        }

        // 5. שמירה סופית
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { phone, Action: "Success", Details: `ID: ${userId} Updated to ${userAge}` });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נרשמו בהצלחה. תודה ולהתראות&hangup=yes`);

    } catch (error) {
        try { await upsertData(process.env.AIRTABLE_TOKEN, process.env.BASE_ID, LOG_TABLE, { phone: "ERROR", Action: "System_Error", Details: error.message }); } catch (e) {}
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
