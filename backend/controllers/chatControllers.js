import asyncHandler from "express-async-handler";
import Chat from "../models/chatModel.js";
import User from "../models/userModel.js";

// @description     Create or fetch One to One Chat
// @route           POST /api/chat/
// @access          Protected
const accessChat = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    console.log("UserId param not sent with request");
    return res.sendStatus(400);
  }

  // Pehle check karo ki kya dono users ke beech koi chat exist karti hai
  var isChat = await Chat.find({
    isGroupChat: false,
    $and: [
      { users: { $elemMatch: { $eq: req.user._id } } },
      { users: { $elemMatch: { $eq: userId } } },
    ],
  })
    .populate("users", "-password")
    .populate("latestMessage");

  isChat = await User.populate(isChat, {
    path: "latestMessage.sender",
    select: "name pic email",
  });

  // Agar chat mil gayi, toh usko return kar do
  if (isChat.length > 0) {
    res.send(isChat[0]);
  } else {
    // Agar nahi mili, toh ek nayi chat create karo
    var chatData = {
      chatName: "sender",
      isGroupChat: false,
      users: [req.user._id, userId],
    };

    try {
      const createdChat = await Chat.create(chatData);
      const FullChat = await Chat.findOne({ _id: createdChat._id }).populate(
        "users",
        "-password"
      );
      res.status(200).json(FullChat);
    } catch (error) {
      res.status(400);
      throw new Error(error.message);
    }
  }
});

// @description     Fetch all chats for a user
// @route           GET /api/chat/
// @access          Protected
const fetchChats = asyncHandler(async (req, res) => {
    try {
        // Database mein wo saari chats dhundho jisme current logged-in user mojood hai
        Chat.find({ users: { $elemMatch: { $eq: req.user._id } } })
            .populate("users", "-password")
            .populate("groupAdmin", "-password")
            .populate("latestMessage")
            .sort({ updatedAt: -1 }) // Sabse nayi chat upar dikhane ke liye sort
            .then(async (results) => {
                results = await User.populate(results, {
                    path: "latestMessage.sender",
                    select: "name pic email",
                });
                res.status(200).send(results);
            });
    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

// @description     Create New Group Chat
// @route           POST /api/chat/group
// @access          Protected
const createGroupChat = asyncHandler(async (req, res) => {
  // Check karo ki frontend ne users aur group ka naam bheja hai ya nahi
  if (!req.body.users || !req.body.name) {
    return res.status(400).send({ message: "Please Fill all the fields" });
  }

  // Frontend se array hamesha string format mein aata hai, usko wapas array banate hain
  var users = JSON.parse(req.body.users);

  // Group mein kam se kam 2 log (tere ilawa) hone chahiye
  if (users.length < 2) {
    return res.status(400).send("More than 2 users are required to form a group chat");
  }

  // Jisne group banaya hai (logged-in user), usko bhi array mein add kar do
  users.push(req.user);

  try {
    // Database mein group create kar rahe hain
    const groupChat = await Chat.create({
      chatName: req.body.name,
      users: users,
      isGroupChat: true,
      groupAdmin: req.user, // Logged in user ko admin bana diya
    });

    // Group banne ke baad, uski poori details nikal kar bhej do
    const fullGroupChat = await Chat.findOne({ _id: groupChat._id })
      .populate("users", "-password")
      .populate("groupAdmin", "-password");

    res.status(200).json(fullGroupChat);
  } catch (error) {
    res.status(400);
    throw new Error(error.message);
  }
});

// @description    Rename Group
// @route          PUT /api/chat/rename
// @access         Protected
const renameGroup = asyncHandler(async (req, res) => {
  const { chatId, chatName } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    { chatName: chatName },
    { new: true } // Yeh naya updated data wapas karega
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!updatedChat) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(updatedChat);
  }
});

// @description    Add user to Group
// @route          PUT /api/chat/groupadd
// @access         Protected
const addToGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  // $push use hota hai array mein naya item jodne ke liye
  const added = await Chat.findByIdAndUpdate(
    chatId,
    { $push: { users: userId } },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!added) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(added);
  }
});

// @description    Remove user from Group (or Leave Group)
// @route          PUT /api/chat/groupremove
// @access         Protected
const removeFromGroup = asyncHandler(async (req, res) => {
  const { chatId, userId } = req.body;

  // $pull use hota hai array se kisi ko nikalne ke liye
  const removed = await Chat.findByIdAndUpdate(
    chatId,
    { $pull: { users: userId } },
    { new: true }
  )
    .populate("users", "-password")
    .populate("groupAdmin", "-password");

  if (!removed) {
    res.status(404);
    throw new Error("Chat Not Found");
  } else {
    res.json(removed);
  }
});

// @description    Update Group Photo
// @route          PUT /api/chat/grouppic
// @access         Protected
const updateGroupPic = asyncHandler(async (req, res) => {
  const { chatId, groupPic } = req.body;

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId, { groupPic }, { new: true }
  ).populate("users", "-password").populate("groupAdmin", "-password");

  if (!updatedChat) { res.status(404); throw new Error("Chat Not Found"); }
  res.json(updatedChat);
});


export { accessChat, fetchChats, createGroupChat, renameGroup, addToGroup, removeFromGroup, updateGroupPic };