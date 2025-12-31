module.exports = async (req, res) => {
    try {
        // שימוש בשיטה מודרנית לקבלת הפרמטרים (פותר את האזהרה)
        const params = { ...req.query, ...req.body };

        const userId = params.user_id;
        const userAge = params.user_age;

        // שלב א: אם אין תעודת זהות
        if (!userId) {
            return res.status(200).send("read=t-נא הקש תעודת זהות ובסיומה סולמית=user_id,no,9,9,10,Digits");
        }

        // שלב ב: אם יש תעודת זהות אבל אין גיל
        if (!userAge) {
            // שים לב לשינוי: 1,3,10 אומר מינימום 1, מקסימום 3 ספרות, 10 שניות המתנה
            return res.status(200).send(`read=t-נא הקש את גילך ובסיומו סולמית=user_age,no,1,3,10,Digits&user_id=${userId}`);
        }

        // שלב ג: סיום הרישום
        const summary = `תודה רבה. תעודת זהות ${userId} גיל ${userAge} נקלטו בהצלחה`;
        return res.status(200).send(`id_list_message=t-${summary}&hangup=yes`);

    } catch (error) {
        console.error(error);
        return res.status(200).send("id_list_message=t-חלה שגיאה במערכת");
    }
};
