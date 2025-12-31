module.exports = async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
        const params = Object.fromEntries(fullUrl.searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;

        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,1,Digits,yes&user_id=${userId}`);
        }

        // --- כאן מדביקים את הנתונים שהוצאת ---
        const AIRTABLE_TOKEN = 'pat... המפתח הסודי שלך'; 
        const BASE_ID = 'app... המזהה של הבייס';
        const TABLE_NAME = 'Table 1'; // וודא שזה השם המדויק

        const airtableUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

        const data = {
            records: [
                {
                    fields: {
                        "ID": userId, // וודא שבטבלה יש עמודה שנקראת ID
                        "Age": parseInt(userAge) // וודא שבטבלה יש עמודה שנקראת Age
                    }
                }
            ]
        };

        // שליחת הנתונים ל-Airtable
        await fetch(airtableUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        // סיום והשמעה
        const responseMsg = `id_list_message=t-נרשמת בהצלחה תעודת זהות.d-${userId}.t-גיל.n-${userAge}.t-נקלטו בטבלה&hangup=yes`;
        return res.status(200).send(responseMsg);

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה בשמירת הנתונים בטבלה");
    }
};
