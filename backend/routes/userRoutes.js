import express from "express";
import { sendOTP, verifyOTP, authUser, allUsers, updateUserProfile } from "../controllers/userControllers.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Naye OTP wale routes
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

// Login route
router.post("/login", authUser);

// Search users ka route (ispe protect lagana zaroori hai)
router.route("/").get(protect, allUsers);

router.route("/profile").put(protect, updateUserProfile);

export default router;