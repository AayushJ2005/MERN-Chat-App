import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
import asyncHandler from "express-async-handler";

const protect = asyncHandler(async (req, res, next) => {
  let token;

  // Check karte hain ki request ke headers mein 'Authorization' bheja hai ya nahi
  // aur kya wo 'Bearer' word se shuru hota hai (yeh standard format hai)
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Token nikalte hain ("Bearer eyJhbGci..." mein se sirf "eyJhbGci..." lenge)
      token = req.headers.authorization.split(" ")[1];

      // Token ko hamari secret key se verify karte hain (decode)
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Token ke andar jo user ID (decoded.id) chhipi thi, us se user dhundhte hain
      // '-password' ka matlab hai ki req.user mein password mat dalna security ke liye
      req.user = await User.findById(decoded.id).select("-password");

      // Bouncer ne check kar liya, ab agle function (controller) ko bulao
      next();
    } catch (error) {
      res.status(401);
      throw new Error("Not authorized, token failed");
    }
  }

  // Agar token bheja hi nahi gaya
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
});

export { protect };