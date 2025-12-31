const AIRTABLE_TOKEN = 'patiuDWzuJf42NoCY.ca145e8a5b0551c953e6916ffdb1b25bb26b88cf072aac3c1ba6cb8674adce98'; 
const BASE_ID = 'appNw4gVE9L38s6mD';
const TABLE_NAME = 'Table 1';

module.exports = async (req, res) => {
    try {
        const params = { ...req.query, ...req.body };
        const phone = params.ApiPhone;
        
        // את החיפוש הראשוני אנחנו חייבים להשאיר עם await כי אנחנו צריכים לדעת אם המשתמש קיים
        const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}?filterByFormula={Phone}='${phone}'`;
        const searchRes = await fetch(searchUrl, { headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` } });
        const searchData = await searchRes.json();
        const userRecord = searchData.records && searchData.records[0];

        // 1. תפריט למשתמש קיים
        if (userRecord && !params.edit_field && !params.user_id && !params.user_age) {
            const { ID, Age } = userRecord.fields;
            if (ID && Age) {
                return res.status(200).send(`read=t-שלום. אתם רשומים עם תעודת זהות.d-${ID}. וגיל.n-${Age}. לשינוי תעודת זהות הקישו 1. לשינוי גיל הקישו 2. למחיקה הקישו 3=edit_field,,1,1,Digits,no`);
            }
        }

        // 2. טיפול במחיקה - כאן אפשר בלי await (המשתמש ישמע "נמחק" בזמן שהמחיקה מתבצעת)
        if (params.edit_field === '3') {
            fetch(`https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}/${userRecord.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${AIRTABLE_TOKEN}` }
            });
            return res.status(200).send("id_list_message=t-הרישום נמחק בהצלחה&hangup=yes");
        }

        // 3. זרימת הרישום
        if (!params.user_id && (!userRecord || !userRecord.fields.ID || params.edit_field === '1')) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שמירה אסינכרונית - הורדנו את ה-await!
        if (params.user_id) {
            upsertUser(phone, { "ID": params.user_id }, userRecord);
        }

        const currentID = params.user_id || (userRecord && userRecord.fields.ID);
        if (!params.user_age && (!userRecord || !userRecord.fields.Age || params.edit_field === '2')) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית. לדילוג הקישו סולמית=user_age,,3,0,Digits,yes&user_id=${currentID}`);
        }

        // עדכון סופי אסינכרוני
        if (params.user_age !== undefined) {
            upsertUser(phone, { "Age": params.user_age || "לא צוין" }, userRecord);
        }

        return res.status(200).send("id_list_message=t-הנתונים עודכנו בהצלחה&hangup=yes");

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת");
    }
};

// הפונקציה נשארת דומה, אבל אנחנו לא מחכים לה בקוד הראשי
async function upsertUser(phone, fields, record) {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}${record ? '/' + record.id : ''}`;
    const method = record ? 'PATCH' : 'POST';
    const body = record ? { fields } : { records: [{ fields: { Phone: phone, ...fields } }] };

    try {
        await fetch(url, {
            method,
            headers: { 'Authorization': `Bearer ${AIRTABLE_TOKEN}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
    } catch (e) {
        console.error("Async save failed:", e);
    }
}
