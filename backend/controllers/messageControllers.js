import asyncHandler from "express-async-handler";
import Message from "../models/messageModel.js";
import User from "../models/userModel.js";
import Chat from "../models/chatModel.js";

// @description     Create New Message
// @route           POST /api/message/
// @access          Protected
const sendMessage = asyncHandler(async (req, res) => {
  const { content, chatId } = req.body;

  if (!content || !chatId) {
    console.log("Invalid data passed into request");
    return res.sendStatus(400);
  }

  // --- NAYA SECURITY CHECK ---
  // Pehle check karo ki chat exist karti hai aur user usme hai ya nahi
  const chatData = await Chat.findById(chatId);
  if (chatData && chatData.isGroupChat && !chatData.users.includes(req.user._id)) {
    res.status(403);
    throw new Error("Action blocked: You are no longer part of this group!");
  }

  var newMessage = {
    sender: req.user._id,
    content: content,
    chat: chatId,
  };

  try {
    // 1. Message database mein save kiya
    var message = await Message.create(newMessage);

    // 2. Message ke andar sender aur chat ki details bhari (populate)
    message = await message.populate("sender", "name pic");
    message = await message.populate("chat");
    message = await User.populate(message, {
      path: "chat.users",
      select: "name pic email",
    });

    // 3. Chat model ko update kiya ki yeh naya message ab 'latestMessage' hai
    await Chat.findByIdAndUpdate(req.body.chatId, { latestMessage: message });

    res.json(message);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @description     Get all Messages for a single Chat
// @route           GET /api/message/:chatId
// @access          Protected
const allMessages = asyncHandler(async (req, res) => {
  try {
    const messages = await Message.find({ chat: req.params.chatId })
      .populate("sender", "name pic email")
      .populate("chat");
    res.json(messages);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// --- NAYA FUNCTION: DELETE MESSAGE ---
const deleteMessage = asyncHandler(async (req, res) => {
  try {
    const messageId = req.params.messageId;
    await Message.findByIdAndDelete(messageId);
    res.status(200).json({ success: true, messageId });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @description     Mark all messages in a chat as read
// @route           PUT /api/message/read
// @access          Protected
const markMessagesAsRead = async (req, res) => {
  try {
    const { chatId } = req.body;

    // Un saare messages ko dhoondho jo is chat ke hain, 
    // jo tune nahi bheje (sender tu nahi hai), aur jisme tera naam 'readBy' mein nahi hai
    const updatedMessages = await Message.updateMany(
      { 
        chat: chatId, 
        sender: { $ne: req.user._id }, 
        readBy: { $ne: req.user._id } 
      },
      { 
        $push: { readBy: req.user._id } 
      }
    );

    res.status(200).json({ message: "Messages marked as read", updatedMessages });
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
};



export { allMessages, sendMessage, deleteMessage, markMessagesAsRead};