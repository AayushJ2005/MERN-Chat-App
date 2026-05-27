import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { accessChat, fetchChats, createGroupChat } from "../controllers/chatControllers.js";

const router = express.Router();

// Notice kar: Route aur Controller ke beech mein 'protect' laga diya hai
router.post("/", protect, accessChat);
router.get("/", protect, fetchChats);
router.post("/group", protect, createGroupChat);

export default router;