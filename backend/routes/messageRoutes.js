import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { allMessages, sendMessage, deleteMessage, markMessagesAsRead } from "../controllers/messageControllers.js";

const router = express.Router();

router.route("/:chatId").get(protect, allMessages);
router.route("/").post(protect, sendMessage);
router.route("/:messageId").delete(protect, deleteMessage);
// --- NAYA ROUTE: Read Receipts ke liye ---
router.route("/read").put(protect, markMessagesAsRead);

export default router;