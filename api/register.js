module.exports = async (req, res) => {
    try {
        // פירוק פרמטרים בצורה מודרנית למניעת אזהרות
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
        const params = Object.fromEntries(fullUrl.searchParams);
        if (req.body) Object.assign(params, req.body);

        const userId = params.user_id;
        const userAge = params.user_age;

        // שלב א: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב ב: בקשת גיל
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,1,Digits,yes&user_id=${userId}`);
        }

        // --- שלב ג: הגדרות Airtable (החלף כאן את הנתונים שלך) ---
        const AIRTABLE_TOKEN = 'patiuDWzuJf42NoCY.ca145e8a5b0551c953e6916ffdb1b25bb26b88cf072aac3c1ba6cb8674adce98'; 
        const BASE_ID = 'appNw4gVE9L38s6mD';
        const TABLE_NAME = 'Table 1'; // וודא שזה השם המדויק ב-Airtable

        const airtableUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

        // הכנת הנתונים למשלוח
        const data = {
            records: [
                {
                    fields: {
                        "ID": userId,   // וודא שיש עמודה בשם ID (אותיות גדולות)
                        "Age": parseInt(userAge) // וודא שיש עמודה בשם Age (אותיות גדולות)
                    }
                }
            ]
        };

        // שליחת הנתונים ל-Airtable
        const airtableResponse = await fetch(airtableUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await airtableResponse.json();

        // בדיקה אם הרישום הצליח
        if (!airtableResponse.ok) {
            console.error("Airtable Error:", result);
            // המערכת תקריא לך את השגיאה בטלפון כדי שתדע מה לתקן
            const errorMsg = result.error.message || "שגיאה לא ידועה";
            return res.status(200).send(`id_list_message=t-שגיאה בשמירה לטבלה.t-${errorMsg}&hangup=yes`);
        }

        // שלב ד: סיום מוצלח
        const responseMsg = `id_list_message=t-נרשמת בהצלחה תעודת זהות.d-${userId}.t-גיל.n-${userAge}.t-הנתונים נשמרו בטבלה&hangup=yes`;
        return res.status(200).send(responseMsg);

    } catch (error) {
        console.error("General Error:", error);
        return res.status(200).send("id_list_message=t-חלה שגיאה כללית במערכת הרישום&hangup=yes");
    }
};
