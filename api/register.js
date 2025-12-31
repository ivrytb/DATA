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

        // ניקוי נתונים: הסרת רווחים מיותרים
        const userId = params.user_id ? String(params.user_id).trim() : null;
        const userAge = params.user_age ? String(params.user_age).trim() : null;
        const phone = (params.ApiPhone || '000').trim();
        const editMode = params.edit_mode;

        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב החיפוש - הוספנו trim גם בתוך הנוסחה של Airtable
        let userRecordId = null;
        let existingAge = null;

        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula=TRIM({ID})='${userId}'`;
        
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        
        if (searchData.records && searchData.records.length > 0) {
            userRecordId = searchData.records[0].id;
            existingAge = searchData.records[0].fields.Age;
        }

        // לוג לצורך בדיקה - האם החיפוש מצא משהו?
        console.log(`Search result for ${userId}: ${userRecordId ? 'Found' : 'Not Found'}`);

        if (userRecordId && existingAge && !userAge && !editMode) {
            return res.status(200).send(`read=t-תעודת זהות זו רשומה עם גיל.n-${existingAge}.t-לעדכון הגיל הקישו 1.t-ליציאה הקישו סולמית=edit_mode,,1,1,Digits,yes&user_id=${userId}`);
        }

        if (editMode === '') return res.status(200).send("id_list_message=t-תודה ולהתראות&hangup=yes");

        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,0,Digits,yes&user_id=${userId}`);
        }

        // שמירה/עדכון
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        
        // לוג הצלחה
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, 
            Action: "Success", 
            Details: `ID: ${userId} Age: ${userAge} Mode: ${userRecordId ? 'Update' : 'New'}` 
        });

        return res.status(200).send(`id_list_message=t-הנתונים עבור תעודת זהות.d-${userId}.t-נרשמו בהצלחה.t-תודה ולהתראות&hangup=yes`);

    } catch (error) {
        console.error("Error:", error);
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

    const body = recordId ? { fields } : { records: [{ fields }] };

    await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
}
