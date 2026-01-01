const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
    // טעינת משתנים
    const {
        AIRTABLE_TOKEN,
        BASE_ID,
        EMAIL_USER,
        EMAIL_PASS
    } = process.env;
    
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

        if (!userId) return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");

        // שלב חיפוש
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={ID}='${userId}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        let userRecordId = searchData.records?.[0]?.id;

        // יצירה ראשונית אם לא קיים
        if (!userRecordId) {
            const createRes = await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge: "בתהליך" });
            const newData = await createRes.json();
            userRecordId = newData.id;
        }

        if (!userAge) return res.status(200).send(`read=t-נא הקש גיל=user_age,,3,0,Digits,yes&user_id=${userId}`);

        // עדכון סופי - מחכים לו!
        await upsertData(AIRTABLE_TOKEN, BASE_ID, TABLE_NAME, { phone, userId, userAge }, userRecordId);
        
        // שליחת מייל - הוספתי await כדי לוודא שזה לא "נחתך" באמצע
        try {
            await sendSingleNotification(EMAIL_USER, EMAIL_PASS, { userId, userAge, phone });
            console.log("Email sent successfully");
        } catch (e) {
            console.log("Email Error: " + e.message);
        }

        // כתיבת לוג - הוספתי await
        await upsertData(AIRTABLE_TOKEN, BASE_ID, LOG_TABLE, { 
            phone, Action: "Success", Details: `ID: ${userId} Age: ${userAge}` 
        });

        return res.status(200).send(`id_list_message=t-נרשם בהצלחה&hangup=yes`);

    } catch (error) {
        console.error("Global Error:", error.message);
        return res.status(200).send("id_list_message=t-תקלה במערכת&hangup=yes");
    }
};

async function sendSingleNotification(user, pass, info) {
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    return transporter.sendMail({
        from: user,
        to: user,
        subject: `✅ רישום חדש: ${info.userId}`,
        text: `ת"ז: ${info.userId}, גיל: ${info.userAge}, טלפון: ${info.phone}`
    });
}

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
