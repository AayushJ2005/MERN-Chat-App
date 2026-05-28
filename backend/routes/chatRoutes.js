import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { accessChat, fetchChats, createGroupChat } from "../controllers/chatControllers.js";
import { renameGroup, removeFromGroup, addToGroup } from "../controllers/chatControllers.js";
import { updateGroupPic } from "../controllers/chatControllers.js"; // Import kar lena
const router = express.Router();

// Notice kar: Route aur Controller ke beech mein 'protect' laga diya hai
router.post("/", protect, accessChat);
router.get("/", protect, fetchChats);
router.post("/group", protect, createGroupChat);

// Neeche routes mein yeh add kar de
router.route("/rename").put(protect, renameGroup);
router.route("/groupremove").put(protect, removeFromGroup);
router.route("/groupadd").put(protect, addToGroup);

router.route("/grouppic").put(protect, updateGroupPic);
export default router;