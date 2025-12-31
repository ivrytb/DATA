module.exports = async (req, res) => {
    try {
        const protocol = req.headers['x-forwarded-proto'] || 'http';
        const fullUrl = new URL(req.url, `${protocol}://${req.headers.host}`);
        const params = Object.fromEntries(fullUrl.searchParams);
        
        if (req.body) {
            Object.assign(params, req.body);
        }

        const userId = params.user_id;
        const userAge = params.user_age;

        // שלב א: בקשת תעודת זהות
        if (!userId) {
            // מבנה: שם_פרמטר,השמעת_הקשות,מקסימום,מינימום,סוג,סולמית
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב ב: בקשת גיל
        if (!userAge) {
            // סדר מתוקן: מקסימום 3, מינימום 1
            return res.status(200).send(`read=t-נא הקש גיל ובסיומו סולמית=user_age,,3,1,Digits,yes&user_id=${userId}`);
        }

        // שלב ג: סיום הרישום - הפרדה בין טקסט למספרים ללא נקודות אסורות
        // השתמשנו בנקודה רק כמפריד בין סוגי הודעות (t- ל-n-)
        const responseMsg = `id_list_message=t-נרשמת בהצלחה תעודת זהות.n-${userId}.t-גיל.n-${userAge}.t-נקלטו במערכת&hangup=yes`;
        
        return res.status(200).send(responseMsg);

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת");
    }
};
