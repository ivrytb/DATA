module.exports = async (req, res) => {
    try {
        const params = { ...req.query, ...req.body };

        const userId = params.user_id;
        const userAge = params.user_age;

        // שלב א: בקשת תעודת זהות
        if (!userId) {
            // מבנה: שם_פרמטר,השמעת_הקשות,מינימום,מקסימום,סוג,סולמית
            // דילגנו על 'השמעת הקשות' בעזרת פסיק ריק
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,,9,9,Digits,yes");
        }

        // שלב ב: בקשת גיל
        if (!userAge) {
            // המערכת כבר צברה את user_id ותשלח אותו שוב אוטומטית
            return res.status(200).send("read=t-נא הקש גיל ובסיומו סולמית=user_age,,1,3,Digits,yes");
        }

        // שלב ג: סיום - קבלת שני הפרמטרים
        const summary = `נרשמת בהצלחה. תעודת זהות ${userId} וגיל ${userAge} נקלטו`;
        return res.status(200).send(`id_list_message=t-${summary}&hangup=yes`);

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת");
    }
};
