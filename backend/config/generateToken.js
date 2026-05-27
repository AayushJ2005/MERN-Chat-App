import jwt from "jsonwebtoken";

const generateToken = (id) => {
    // Yeh function user ki ID ko hamare secret key ke sath lock karke ek token banayega
    // '30d' ka matlab token 30 din tak valid rahega (user 30 din tak logged in rahega)
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "30d",
    });
};

export default generateToken;