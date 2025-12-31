module.exports = async (req, res) => {
    try {
        // ב-Vercel הנתונים מגיעים כבר מוכנים ב-body (בגלל שזה Node.js native)
        const params = { ...req.query, ...req.body };

        const userId = params.user_id;
        const userAge = params.user_age;

        // שלב א: בקשת תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות בסיום הקש סולמית=user_id,no,9,9,7,Digits");
        }

        // שלב ב: בקשת גיל (שולחים שוב את ה-userId כדי לשמור עליו)
        if (!userAge) {
            return res.status(200).send(`read=t-נא הקש את גילך=user_age,no,1,3,7,Digits&user_id=${userId}`);
        }

        // שלב ג: סיום
        const summary = `נרשמת בהצלחה תעודת זהות ${userId} גיל ${userAge}`;
        return res.status(200).send(`id_list_message=t-${summary}&hangup=yes`);

    } catch (error) {
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת");
    }
};
