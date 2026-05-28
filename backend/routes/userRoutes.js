import express from "express";
import { registerUser, authUser, allUsers, updateUserProfile } from "../controllers/userControllers.js";
import { protect } from "../middleware/authMiddleware.js";
import { googleLogin } from "../controllers/userControllers.js";

const router = express.Router();


// Login route
router.post("/login", authUser);

// Search users ka route (ispe protect lagana zaroori hai)
router.route("/").get(protect, allUsers);

router.route("/profile").put(protect, updateUserProfile);

router.post("/google-login", googleLogin);

export default router;