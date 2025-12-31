// --- שלב ג: הגדרות Airtable (החלף כאן את הנתונים שלך) ---
  

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

        // --- הגדרות Airtable (הנתונים שלך כבר כאן) ---
        const AIRTABLE_TOKEN = 'patiuDWzuJf42NoCY.ca145e8a5b0551c953e6916ffdb1b25bb26b88cf072aac3c1ba6cb8674adce98'; 
        const BASE_ID = 'appNw4gVE9L38s6mD';
        const TABLE_NAME = 'Table 1';

        const airtableUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE_NAME)}`;

        // שינוי כאן: שולחים את הגיל כטקסט כדי למנוע את השגיאה שקיבלת
        const data = {
            records: [
                {
                    fields: {
                        "ID": String(userId).trim(),
                        "Age": String(userAge).trim() 
                    }
                }
            ]
        };

        const airtableResponse = await fetch(airtableUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${AIRTABLE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        const result = await airtableResponse.json();

        if (!airtableResponse.ok) {
            console.error("Airtable Error:", result);
            const errorMsg = result.error.message || "שגיאה";
            return res.status(200).send(`id_list_message=t-שגיאה בשמירה.t-${errorMsg}&hangup=yes`);
        }

        const responseMsg = `id_list_message=t-נרשמת בהצלחה תעודת זהות.d-${userId}.t-גיל.n-${userAge}.t-הנתונים נשמרו&hangup=yes`;
        return res.status(200).send(responseMsg);

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה כללית&hangup=yes");
    }
};
