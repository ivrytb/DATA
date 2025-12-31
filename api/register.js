module.exports = async (req, res) => {
    try {
        const params = { ...req.query, ...req.body };

        // שליפת הנתונים - המערכת תחזיר לנו את user_id בבקשה הבאה כי שירשרנו אותו
        const userId = params.user_id;
        const userAge = params.user_age;

        // שלב א: בקשת תעודת זהות
        if (!userId) {
            // הגדרות: 9 ספרות מינימום ומקסימום, המתנה 10 שניות, סיום בסולמית
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,no,9,9,10,Digits,yes");
        }

        // שלב ב: יש ת"ז, חסר גיל
        if (!userAge) {
            // כאן התיקון הקריטי: אנחנו מוסיפים את ה-user_id כפרמטר נוסף לתשובה
            // והגדרנו 1,3,10,Digits,yes (ה-yes בסוף מחייב סולמית ומונע את הפרדוקס)
            return res.status(200).send(
                `read=t-נא הקש גיל ובסיומו סולמית=user_age,no,1,3,10,Digits,yes&user_id=${userId}`
            );
        }

        // שלב ג: סיום
        return res.status(200).send(`id_list_message=t-נרשמת בהצלחה תעודת זהות ${userId} גיל ${userAge}&hangup=yes`);

    } catch (error) {
        return res.status(200).send("id_list_message=t-שגיאה");
    }
};
