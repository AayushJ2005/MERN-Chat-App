import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { io } from "socket.io-client";
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const ENDPOINT = "https://mern-chat-app-o0zp.onrender.com";
let socket;

const Chatpage = () => {
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState([]);
  const [selectedChat, setSelectedChat] = useState();
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingChats, setTypingChats] = useState([]);

  // --- ONLINE USERS ---
  const [onlineUsers, setOnlineUsers] = useState([]);

  // --- GROUP CHAT STATES ---
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupChatName, setGroupChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSearchResult, setGroupSearchResult] = useState([]);
  const [imageLoading, setImageLoading] = useState(false);

  // --- PROFILE STATES ---
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [pic, setPic] = useState("");

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));

  // --- UPDATE GROUP STATES ---
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [groupRename, setGroupRename] = useState("");
  const [renameLoading, setRenameLoading] = useState(false);
  const [groupPicLoading, setGroupPicLoading] = useState(false);

  // --- NOTIFICATION STATE (Sirf array chahiye badge ke liye, ghanti hata di) ---
  const [notification, setNotification] = useState([]);

  const [showMenu, setShowMenu] = useState(false); // 3-dots menu ke liye
  const [isSelectMode, setIsSelectMode] = useState(false); // Select mode on/off
  const [selectedMessages, setSelectedMessages] = useState([]); // Select kiye hue messages ki list

  // --- CAMERA STATES ---
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // --- REACTION STATES ---
  const [reactionPickerId, setReactionPickerId] = useState(null);

  const handleReaction = async (messageId, emoji) => {
    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };

      // 1. API Call karke DataBase mein save karo
      await axios.put("/api/message/react", { messageId, emoji }, config);

      // 2. Apni screen par turant emoji dikhao (Optimistic UI)
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId
            ? { ...msg, reactions: [...(msg.reactions || []), { emoji, by: userInfo._id }] }
            : msg
        )
      );

      // 3. Socket ke through saamne wale ko signal bhejo
      socket.emit("new reaction", {
        messageId,
        emoji,
        chatId: selectedChat._id,
        userId: userInfo._id
      });

      setReactionPickerId(null); // Popup band karo
    } catch (error) {
      toast.error("Failed to add reaction");
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const logoutHandler = () => {
    localStorage.removeItem("userInfo");
    if (socket) socket.disconnect();
    navigate("/");
  };

  // --- NAYA CAMERA LOGIC ---
  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      toast.error("Camera access denied! 📷");
      setShowCamera(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) cameraStream.getTracks().forEach(track => track.stop());
    setCameraStream(null);
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;

    // Video se image draw karo
    context.drawImage(videoRef.current, 0, 0);

    // Canvas ko file mein convert karke Cloudinary bhej do
    canvasRef.current.toBlob((blob) => {
      const file = new File([blob], "camera-capture.jpg", { type: "image/jpeg" });
      stopCamera(); // Camera band karo
      handleFileMessage(file); // 🔥 TERA PURANA UPLOAD FUNCTION
    }, "image/jpeg");
  };

  // --- CONNECTION & ONLINE STATUS SETUP ---
  useEffect(() => {
    if (userInfo) {
      setEditName(userInfo.name);
      setPic(userInfo.pic);
      socket = io(ENDPOINT);

      socket.on("get-online-users", (users) => {
        setOnlineUsers(users);
      });

      socket.on("typing", (chatId) => {
        setTypingChats((prev) => [...new Set([...prev, chatId])]);
      });

      socket.on("stop typing", (chatId) => {
        setTypingChats((prev) => prev.filter((id) => id !== chatId));
      });

      // 🔥 FIX 1: Page load hote hi turant bhej do (Taaki miss na ho)
      socket.emit("setup", userInfo);

      // 🔥 FIX 2: Agar server restart (crash) ho jaye, toh wapas judne par bhejo
      socket.on("connect", () => {
        socket.emit("setup", userInfo);
      });

    }

    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  const fetchChats = async () => {
    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.get("/api/chat", config);
      setChats(data);
    } catch (error) { toast.error("Failed to load chats"); }
  };

  useEffect(() => { fetchChats(); }, []);

  const handleInputChange = async (e) => {
    const query = e.target.value;
    setSearch(query);
    if (!query) { setIsSearchActive(false); setSearchResult([]); return; }
    try {
      setIsSearchActive(true);
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.get(`/api/user?search=${query}`, config);
      setSearchResult(data);
    } catch (error) { console.error("Failed to Load Search Results"); }
  };

  const createChat = async (userId) => {
    try {
      const config = { headers: { "Content-type": "application/json", Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.post("/api/chat", { userId }, config);
      if (!chats.find((c) => c._id === data._id)) setChats([data, ...chats]);
      setSelectedChat(data);
      socket.emit("join chat", data._id);
      setSearch(''); setSearchResult([]); setIsSearchActive(false);
    } catch (error) { toast.error("Error creating chat."); }
  };

  const fetchMessages = async () => {
    if (!selectedChat) return;
    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.get(`/api/message/${selectedChat._id}`, config);
      setMessages(data);

      // Sirf database mein read mark karega, socket tang nahi karega
      try {
        await axios.put("/api/message/read", { chatId: selectedChat._id }, config);
        socket.emit("mark as read", selectedChat._id);
      } catch (err) {
        console.log("Error marking messages as read", err);
      }

      socket.emit("join chat", selectedChat._id);
    } catch (error) { console.error("Error fetching messages"); }
  };

  useEffect(() => { fetchMessages(); }, [selectedChat]);


  // --- BADA WALA useEffect YAHAN SE SHURU ---
  useEffect(() => {
    const messageListener = (newMessageRecieved) => {
      if (newMessageRecieved.sender._id !== userInfo._id) {
        const audio = new Audio("/ting.mp3");
        audio.play().catch((err) => console.log("Browser autoplay blocked", err));
      }

      if (!selectedChat || selectedChat._id !== newMessageRecieved.chat._id) {
        if (!notification.includes(newMessageRecieved)) {
          setNotification([newMessageRecieved, ...notification]);
        }
      } else {
        setMessages((prevMessages) => [...prevMessages, newMessageRecieved]);
        const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
        axios.put("/api/message/read", { chatId: selectedChat._id }, config).catch(err => console.log(err));
        socket.emit("mark as read", selectedChat._id);
      }

      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c._id === newMessageRecieved.chat._id);
        if (chatIndex !== -1) {
          const chatToMove = prevChats[chatIndex];
          chatToMove.latestMessage = newMessageRecieved;
          const otherChats = prevChats.filter((c) => c._id !== newMessageRecieved.chat._id);
          return [chatToMove, ...otherChats];
        } else {
          return [newMessageRecieved.chat, ...prevChats];
        }
      });
    };

    const deleteListener = (deletedMessageId) => {
      setMessages((prevMessages) => prevMessages.filter((m) => m._id !== deletedMessageId));
    };

    const handleTyping = () => setIsTyping(true);
    const handleStopTyping = () => setIsTyping(false);

    // 🔥 NAYA: REACTION LISTENER YAHAN LAGEGA 🔥
    const reactionListener = (reactionData) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === reactionData.messageId
            ? { ...msg, reactions: [...(msg.reactions || []), { emoji: reactionData.emoji, by: reactionData.userId }] }
            : msg
        )
      );
    };

    // 🔥 NAYA: BLUE TICK LISTENER 🔥
    const readListener = (chatRoom) => {
      // Agar meri current open chat wahi hai jiska message padha gaya hai
      if (selectedChat && selectedChat._id === chatRoom) {
        setMessages((prev) =>
          prev.map((msg) =>
            // Jo messages MAINE bheje the, unko "Read" mark karke UI update kar do
            msg.sender._id === userInfo._id
              ? { ...msg, readBy: [{ _id: "read_dummy" }] } // Ye blue tick trigger kar dega
              : msg
          )
        );
      }
    };

    socket.on("message received", messageListener);
    socket.on("message deleted", deleteListener);
    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);
    socket.on("message reacted", reactionListener); // Isko ON kiya
    socket.on("messages read", readListener);

    return () => {
      socket.off("message received", messageListener);
      socket.off("message deleted", deleteListener);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
      socket.off("message reacted", reactionListener); // Isko OFF kiya
      socket.off("messages read", readListener);
    };
  }, [selectedChat, notification]);
  // --- BADA WALA useEffect YAHAN KHATAM ---

  const typingHandler = (e) => {
    setNewMessage(e.target.value);
    if (!selectedChat) return;

    if (!typing) {
      setTyping(true);
      // 🔥 FIX 1: Exact wahi payload jo server ko chahiye
      socket.emit("typing", selectedChat._id);
    }

    if (window.typingTimer) clearTimeout(window.typingTimer);

    window.typingTimer = setTimeout(() => {
      // 🔥 FIX 2: Exact wahi payload jo server ko chahiye
      socket.emit("stop typing", selectedChat._id);
      setTyping(false);
    }, 3000);
  };

  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage) {
      if (window.typingTimer) clearTimeout(window.typingTimer);
      socket.emit("stop typing", selectedChat._id);
      setTyping(false);
      try {
        const config = { headers: { "Content-type": "application/json", Authorization: `Bearer ${userInfo.token}` } };
        const messageToSend = newMessage;
        setNewMessage(""); // Input clear karo

        const { data } = await axios.post("/api/message", { content: messageToSend, chatId: selectedChat._id }, config);

        socket.emit("new message", data);
        setMessages((prevMessages) => [...prevMessages, data]);

        // Jab TU message bheje, tab bhi teri chat TOP par aani chahiye
        setChats((prevChats) => {
          const chatIndex = prevChats.findIndex((c) => c._id === data.chat._id);
          if (chatIndex !== -1) {
            const chatToMove = prevChats[chatIndex];
            chatToMove.latestMessage = data;
            const otherChats = prevChats.filter((c) => c._id !== data.chat._id);
            return [chatToMove, ...otherChats];
          }
          return prevChats;
        });

      } catch (error) { toast.error("Error sending message"); }
    }
  };

  // --- NAYA FUNCTION: MESSAGE DELETE KARNE KELIYE ---
  const deleteMessage = async (messageId) => {
    // Pehle confirm karo
    if (!window.confirm("Delete this message for everyone? 🗑️")) return;

    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      await axios.delete(`/api/message/${messageId}`, config);

      // 1. Khud ki screen se hatao
      setMessages((prevMessages) => prevMessages.filter((m) => m._id !== messageId));

      // 2. Doosre ko batane ke liye socket emit karo
      socket.emit("delete message", { messageId: messageId, room: selectedChat._id });

      toast.success("Message deleted! 🗑️");
    } catch (error) {
      toast.error("Failed to delete message!");
    }
  };

  // --- NAYA FUNCTION: MULTIPLE DELETE KARNE KE LIYE (Promise.all ka jaadu) ---
  const deleteSelectedMessages = async () => {
    if (!window.confirm(`Delete ${selectedMessages.length} messages for everyone? 🗑️`)) return;

    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };

      // Har select kiye hue message par delete API call karo ek saath
      await Promise.all(selectedMessages.map(msgId =>
        axios.delete(`/api/message/${msgId}`, config)
      ));

      // Khud ki screen se hatao
      setMessages((prev) => prev.filter((m) => !selectedMessages.includes(m._id)));

      // Doosre ki screen se hatane ke liye har message ka socket emit karo
      selectedMessages.forEach(msgId => {
        socket.emit("delete message", { messageId: msgId, room: selectedChat._id });
      });

      toast.success(`${selectedMessages.length} messages deleted! 🗑️`);
      setIsSelectMode(false);
      setSelectedMessages([]);
    } catch (error) {
      toast.error("Failed to delete some messages!");
    }
  };

  const handleGroupSearch = async (query) => {
    setGroupSearch(query);
    if (!query) { setGroupSearchResult([]); return; }
    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.get(`/api/user?search=${query}`, config);
      setGroupSearchResult(data);
    } catch (error) { toast.error("Failed to Load Search Results"); }
  };

  const handleGroupAdd = (userToAdd) => {
    if (selectedUsers.some(u => u._id === userToAdd._id)) {
      toast.warning("User is already added");
      return;
    }
    setSelectedUsers([...selectedUsers, userToAdd]);
  };

  const handleDeleteUser = (delUser) => {
    setSelectedUsers(selectedUsers.filter((sel) => sel._id !== delUser._id));
  };

  const handleSubmitGroup = async () => {
    if (!groupChatName || !selectedUsers) {
      toast.warning("Please fill all the fields");
      return;
    }
    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.post(
        "/api/chat/group",
        { name: groupChatName, users: JSON.stringify(selectedUsers.map((u) => u._id)) },
        config
      );
      setChats([data, ...chats]);
      setShowGroupModal(false);
      setSelectedUsers([]);
      setGroupSearch("");
      setGroupChatName("");
      toast.success("New Group Chat Created!");
    } catch (error) {
      toast.error("Failed to Create the Group");
    }
  };

  const handleRename = async () => {
    if (!groupRename) return;
    try {
      setRenameLoading(true);
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.put("/api/chat/rename", { chatId: selectedChat._id, chatName: groupRename }, config);

      setSelectedChat(data);
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      setRenameLoading(false);
      setGroupRename("");
      toast.success("Group name updated! ✨");
    } catch (error) {
      toast.error("Error renaming group!");
      setRenameLoading(false);
    }
  };

  const handleAddUser = async (user1) => {
    if (selectedChat.users.find((u) => u._id === user1._id)) {
      toast.warning("User already in group!"); return;
    }
    if (selectedChat.groupAdmin._id !== userInfo._id) {
      toast.error("Only Admin can add someone! 👑"); return;
    }

    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.put("/api/chat/groupadd", { chatId: selectedChat._id, userId: user1._id }, config);
      setSelectedChat(data);
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      toast.success(`${user1.name} added to the group! 🎉`);
    } catch (error) { toast.error("Error adding user!"); }
  };

  // 3. User ko nikalna ya khud Leave karna (BUG FIXED)
  const handleRemove = async (user1) => {
    if (selectedChat.groupAdmin._id !== userInfo._id && user1._id !== userInfo._id) {
      toast.error("Only Admin can remove someone! 👑"); return;
    }

    const isLeaving = user1._id === userInfo._id;
    const confirmMessage = isLeaving
      ? "Are you sure you want to leave this group?"
      : `Are you sure you want to remove ${user1.name} from the group?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.put("/api/chat/groupremove", { chatId: selectedChat._id, userId: user1._id }, config);

      if (isLeaving) {
        // --- BUG FIX: Agar khud leave kiya, toh chat window band karo aur usko list se hamesha ke liye uda do ---
        setSelectedChat();
        setChats(chats.filter((c) => c._id !== selectedChat._id));
        toast.success("You left the group.");
      } else {
        // Kisi aur ko nikala hai, toh bas UI update karo
        setSelectedChat(data);
        setChats(chats.map((c) => (c._id === data._id ? data : c)));
        toast.success(`${user1.name} removed!`);
      }
    } catch (error) {
      toast.error("Error removing user!");
    }
  };

  const handleProfileSave = async () => {
    if (!editName) {
      toast.warning("Name cannot be empty!");
      return;
    }

    try {
      const config = { headers: { "Content-type": "application/json", Authorization: `Bearer ${userInfo.token}` } };
      const { data } = await axios.put("/api/user/profile", { name: editName, pic: pic }, config);

      toast.success("Profile Updated Successfully! 🎉");
      localStorage.setItem("userInfo", JSON.stringify(data));
      setShowProfileModal(false);

      setTimeout(() => { window.location.reload(); }, 1000);
    } catch (error) {
      toast.error("Error Updating Profile");
    }
  };

  const handleGroupPicUpload = (pics) => {
    setGroupPicLoading(true);
    if (!pics) { setGroupPicLoading(false); return; }

    if (pics.type === "image/jpeg" || pics.type === "image/png" || pics.type === "image/webp") {
      const data = new FormData();
      data.append("file", pics);
      data.append("upload_preset", "chat_app_preset");
      data.append("cloud_name", "dkjuexjmp");

      fetch("https://api.cloudinary.com/v1_1/dkjuexjmp/image/upload", { method: "post", body: data })
        .then((res) => res.json())
        .then(async (data) => {
          const config = { headers: { Authorization: `Bearer ${userInfo.token}` } };
          const { data: updatedChat } = await axios.put("/api/chat/grouppic", { chatId: selectedChat._id, groupPic: data.url.toString() }, config);

          setSelectedChat(updatedChat);
          setChats(chats.map((c) => (c._id === updatedChat._id ? updatedChat : c)));
          setGroupPicLoading(false);
          toast.success("Group Photo Updated! 📸");
        })
        .catch((err) => { setGroupPicLoading(false); toast.error("Upload failed"); });
    }
  };

  const handleFileMessage = (file) => {
    if (!file) return;
    setImageLoading(true);

    // 🔥 FIX: Strict check for PDF
    const isDocument = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");

    // 🔥 FIX: URL logic
    const uploadUrl = isDocument
      ? "https://api.cloudinary.com/v1_1/dkjuexjmp/raw/upload"
      : "https://api.cloudinary.com/v1_1/dkjuexjmp/auto/upload";

    const data = new FormData();
    data.append("file", file);
    data.append("upload_preset", "chat_app_preset");
    data.append("cloud_name", "dkjuexjmp");

    fetch(uploadUrl, { method: "post", body: data })
      .then((res) => res.json())
      .then(async (data) => {
        let fileUrl = data.secure_url.toString();
        try {
          const config = { headers: { "Content-type": "application/json", Authorization: `Bearer ${userInfo.token}` } };
          const { data: newMsg } = await axios.post("/api/message", { content: fileUrl, chatId: selectedChat._id }, config);

          socket.emit("new message", newMsg);
          setMessages([...messages, newMsg]);

          setChats((prevChats) => {
            const chatIndex = prevChats.findIndex((c) => c._id === newMsg.chat._id);
            if (chatIndex !== -1) {
              const chatToMove = prevChats[chatIndex];
              chatToMove.latestMessage = newMsg;
              const otherChats = prevChats.filter((c) => c._id !== newMsg.chat._id);
              return [chatToMove, ...otherChats];
            }
            return prevChats;
          });
          setImageLoading(false);
        } catch (error) { toast.error("Error sending file"); setImageLoading(false); }
      })
      .catch((err) => { setImageLoading(false); toast.error("File upload failed"); });
  };


  useEffect(() => {
    if (selectedChat) {
      window.history.pushState(null, null, window.location.href);
    }

    const handleBackButton = () => {
      setSelectedChat(null);
    };

    window.addEventListener("popstate", handleBackButton);

    return () => {
      window.removeEventListener("popstate", handleBackButton);
    };
  }, [selectedChat]);

  return (
    <div className="flex h-[100dvh] w-full bg-gray-100 overflow-x-hidden font-sans relative max-w-[100vw]">

      {/* --- LIVE CAMERA MODAL --- */}
      {showCamera && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="bg-white p-5 rounded-3xl flex flex-col items-center gap-4 shadow-2xl relative">
            <button onClick={stopCamera} className="absolute top-4 right-5 text-gray-500 hover:text-red-500 font-bold text-xl">✕</button>
            <h2 className="text-xl font-extrabold text-gray-800">Take a Photo</h2>

            {/* scale-x-[-1] isliye taaki mirror jaisa dikhe */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full max-w-md bg-black rounded-xl shadow-inner transform scale-x-[-1]"
            />

            {/* Canvas hidden rahega, bas frame extract karne ke kaam aayega */}
            <canvas ref={canvasRef} className="hidden" />

            <button
              onClick={capturePhoto}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-full shadow-lg transition flex items-center gap-2 mt-2"
            >
              📸 Capture & Send
            </button>
          </div>
        </div>
      )}

      {/* --- PROFILE MODAL --- */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-[90%] md:w-[400px] rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-5 relative">
            <button onClick={() => setShowProfileModal(false)} className="absolute top-5 right-6 text-gray-400 hover:text-red-500 font-bold text-xl transition">✕</button>
            <h2 className="text-2xl font-extrabold text-gray-800">My Profile</h2>

            <div className="flex flex-col items-center w-full">
              <img
                src={pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"}
                alt="Profile"
                className="w-32 h-32 rounded-full border-4 border-blue-100 object-cover shadow-md"
              />
            </div>

            <div className="w-full flex flex-col gap-4 mt-2">
              <div>
                <label className="text-xs text-gray-500 font-bold ml-1 uppercase tracking-wider">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-gray-700"
                />
              </div>
            </div>

            <button
              onClick={handleProfileSave}
              className="w-full text-white font-bold py-3 mt-4 rounded-xl transition shadow-lg bg-blue-600 hover:bg-blue-700 shadow-blue-200"
            >
              Save Changes
            </button>
          </div>
        </div>
      )}

      {/* --- GROUP CHAT MODAL --- */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-[90%] md:w-[400px] rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-xl font-bold text-gray-800">Create Group Chat</h2>
              <button onClick={() => setShowGroupModal(false)} className="text-gray-500 hover:text-red-500 font-bold text-lg">✕</button>
            </div>

            <input placeholder="Group Name" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => setGroupChatName(e.target.value)} />
            <input placeholder="Add Users eg: Raj, Aayush..." className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => handleGroupSearch(e.target.value)} />

            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(u => (
                <span key={u._id} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer" onClick={() => handleDeleteUser(u)}>
                  {u.name} <span className="text-blue-500 hover:text-red-500">x</span>
                </span>
              ))}
            </div>

            <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
              {groupSearchResult?.slice(0, 4).map(user => (
                <div key={user._id} onClick={() => handleGroupAdd(user)} className="p-2 bg-gray-50 hover:bg-blue-50 rounded-lg cursor-pointer text-sm flex items-center gap-2 border border-gray-100">
                  <div className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">{user.name.charAt(0)}</div>
                  <div className="flex-col"><p className="font-semibold">{user.name}</p></div>
                </div>
              ))}
            </div>
            <button onClick={handleSubmitGroup} className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition">Create Chat</button>
          </div>
        </div>
      )}

      {/* --- UPDATE GROUP CHAT MODAL --- */}
      {showUpdateModal && selectedChat?.isGroupChat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-[90%] md:w-[450px] rounded-2xl shadow-2xl p-6 flex flex-col gap-4">

            <div className="flex justify-between items-center border-b pb-2">
              <h2 className="text-2xl font-bold text-gray-800">{selectedChat.chatName}</h2>
              <button onClick={() => setShowUpdateModal(false)} className="text-gray-500 hover:text-red-500 font-bold text-lg">✕</button>
            </div>

            <div className="flex flex-col items-center mt-2 mb-2">
              <img
                src={selectedChat.groupPic || "https://cdn-icons-png.flaticon.com/512/166/166258.png"}
                alt="Group DP"
                className="w-20 h-20 rounded-full object-cover border-4 border-blue-50 shadow-md"
              />
              {selectedChat.groupAdmin._id === userInfo._id && (
                <div className="mt-3 w-full text-center">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleGroupPicUpload(e.target.files[0])}
                    className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-3 file:rounded-full file:border-0 file:bg-blue-50 file:text-blue-700 cursor-pointer font-bold transition-all hover:file:bg-blue-100"
                  />
                  {groupPicLoading && <p className="text-xs text-blue-500 mt-1 animate-pulse">Uploading to Cloud...</p>}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 my-2 max-h-40 overflow-y-auto pr-1">
              {selectedChat.users.map((u) => (
                <div key={u._id} className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <img
                      src={u.pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"}
                      alt="avatar"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-gray-300"
                    />
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 text-sm">{u.name} {u._id === userInfo._id && "(You)"}</span>
                      <span className="text-xs text-gray-500">{u.email}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {selectedChat.groupAdmin._id === u._id && (
                      <span className="bg-green-100 text-green-700 text-xs font-extrabold px-2.5 py-1 rounded-md border border-green-200 shadow-sm">👑 Admin</span>
                    )}
                    {(selectedChat.groupAdmin._id === userInfo._id || u._id === userInfo._id) && (
                      <button
                        onClick={() => handleRemove(u)}
                        className="text-gray-400 hover:bg-red-100 hover:text-red-600 h-8 w-8 rounded-full flex items-center justify-center transition-all font-bold"
                        title={u._id === userInfo._id ? "Leave Group" : "Remove User"}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input placeholder="New Group Name" value={groupRename} onChange={(e) => setGroupRename(e.target.value)} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={handleRename} disabled={renameLoading} className="bg-green-500 text-white font-bold px-4 py-2 rounded-lg hover:bg-green-600 transition">Update</button>
            </div>

            {selectedChat.groupAdmin._id === userInfo._id && (
              <>
                <input placeholder="Add Users to Group..." className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" onChange={(e) => handleGroupSearch(e.target.value)} />
                <div className="max-h-32 overflow-y-auto flex flex-col gap-1">
                  {groupSearchResult?.slice(0, 4).map(user => (
                    <div key={user._id} onClick={() => handleAddUser(user)} className="p-2 bg-gray-50 hover:bg-blue-50 rounded-lg cursor-pointer text-sm flex items-center gap-2 border border-gray-100">
                      <div className="bg-blue-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">{user.name.charAt(0)}</div>
                      <p className="font-semibold">{user.name}</p>
                    </div>
                  ))}
                </div>
              </>
            )}

            <button onClick={() => handleRemove(userInfo)} className="w-full bg-red-500 text-white font-bold py-2 mt-2 rounded-lg hover:bg-red-600 transition shadow-md">
              Leave Group
            </button>

          </div>
        </div>
      )}

      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <div className={`${selectedChat ? "hidden md:flex" : "flex"} w-full md:w-1/3 flex-col bg-white border-r border-gray-200 shadow-sm z-10`}>
        <div className="p-4 border-b border-gray-100 bg-gray-50">

          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Chats</h2>

            <div className="flex items-center gap-4">

              {/* --- 1. GROUP BUTTON --- */}
              <button onClick={() => setShowGroupModal(true)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md text-sm font-bold transition-colors border border-blue-200 shadow-sm hidden md:block">
                + Group
              </button>

              {/* --- 2. PROFILE AVATAR --- */}
              <div className="relative">
                <img
                  src={userInfo?.pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"}
                  alt="Profile"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full cursor-pointer border-2 border-transparent hover:border-blue-500 object-cover shadow-sm transition-all"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                />

                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl z-50 border border-gray-100 py-2 overflow-hidden">
                    <button onClick={() => { setIsProfileMenuOpen(false); setShowProfileModal(true); }} className="block w-full text-left px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">👤 My Profile</button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button onClick={logoutHandler} className="block w-full text-left px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">🚪 Logout</button>
                  </div>
                )}
              </div>

            </div>
          </div>

          <div className="relative">
            <input className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm text-sm" placeholder="Search users to start chat..." onChange={handleInputChange} value={search} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isSearchActive ? (
            searchResult.length > 0 ? (
              searchResult.map(u => (
                <div key={u._id} onClick={() => createChat(u._id)} className="p-4 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors flex items-center gap-3">
                  <div className="relative">
                    <img src={u.pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"} className="w-12 h-12 rounded-full object-cover border border-gray-200" alt="pic" />
                    {onlineUsers.includes(u._id) && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div><p className="font-semibold text-gray-800">{u.name}</p><p className="text-xs text-gray-500 truncate">{u.email}</p></div>
                </div>
              ))
            ) : <p className="p-4 text-center text-gray-400 mt-10 text-sm">No user found 😢</p>
          ) : chats.length > 0 ? (
            chats.map(c => {
              const otherUser = c.isGroupChat ? null : (c.users[0]._id === userInfo._id ? c.users[1] : c.users[0]);
              const chatNameDisplay = c.isGroupChat ? c.chatName : otherUser.name;
              const chatPic = c.isGroupChat ? (c.groupPic || "https://cdn-icons-png.flaticon.com/512/166/166258.png") : (otherUser.pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg");

              // --- LOGIC: Is chat ke kitne unread messages hain ---
              const unreadCount = notification.filter((n) => n.chat._id === c._id).length;

              return (
                <div key={c._id} onClick={() => {
                  setSelectedChat(c);
                  // Jab chat open ho, toh us chat ki sari notification uda do taaki badge hat jaye
                  setNotification(notification.filter((n) => n.chat._id !== c._id));
                }} className={`p-4 border-b border-gray-50 cursor-pointer flex items-center gap-4 transition-colors ${selectedChat?._id === c._id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}>

                  <div className="relative">
                    <img src={chatPic} className="w-12 h-12 rounded-full object-cover border border-gray-200" alt="pic" referrerPolicy="no-referrer" />
                    {!c.isGroupChat && onlineUsers.includes(otherUser._id) && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center">
                      <p className="font-semibold text-gray-800 text-base">{chatNameDisplay}</p>

                      {/* --- UNREAD MESSAGE COUNT BADGE --- */}
                      {unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                          {unreadCount}
                        </span>
                      )}
                    </div>

                    {/* --- BOLD TEXT HIGHIGHT AUR NAYA TYPING INDICATOR --- */}
                    <p className={`text-xs truncate mt-0.5 ${unreadCount > 0 ? 'text-gray-800 font-bold' : 'text-gray-500'}`}>
                      {typingChats.includes(c._id) ? (
                        <span className="text-green-500 font-bold italic animate-pulse">typing...</span>
                      ) : c.latestMessage ? (
                        c.latestMessage.content.includes("res.cloudinary.com") ? "📷 Image" : c.latestMessage.content
                      ) : (
                        "Start chatting..."
                      )}
                    </p>
                  </div>
                </div>
              );
            })
          ) : <div className="flex flex-col items-center justify-center h-full text-gray-400"><p className="mt-4 text-sm font-medium">No chats yet.</p><p className="text-xs">Search for a user to start!</p></div>}
        </div>
      </div>

      {/* ---------------- RIGHT CHAT WINDOW ---------------- */}
      <div className={`${selectedChat ? "flex" : "hidden md:flex"} flex-1 flex-col bg-slate-50 relative w-full`}>
        {selectedChat ? (
          <>
            <div className="py-2 px-3 sm:p-4 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm flex items-center gap-2 sm:gap-4 sticky top-0 z-10 w-full box-border">

              {/* --- NAYA BACK BUTTON FOR MOBILE --- */}
              <button
                onClick={() => window.history.back()}
                className="md:hidden text-gray-600 hover:text-blue-600 text-xl mr-1"
              >
                ⬅️
              </button>

              <div className="relative">
                <img
                  src={selectedChat.isGroupChat ? (selectedChat.groupPic || "https://cdn-icons-png.flaticon.com/512/166/166258.png") : ((selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1].pic : selectedChat.users[0].pic) || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg")}
                  className="w-10 h-10 rounded-full object-cover border border-gray-200"
                  alt="pic"
                  referrerPolicy="no-referrer"
                />
                {!selectedChat.isGroupChat && onlineUsers.includes(selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1]._id : selectedChat.users[0]._id) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                )}
              </div>

              {/* --- HEADER TEXT, MANAGE BUTTON & SEARCH ICON --- */}
              <div className="flex flex-col w-full">
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-gray-800 tracking-wide leading-tight">
                      {selectedChat.isGroupChat ? selectedChat.chatName : (selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1].name : selectedChat.users[0].name)}
                    </h2>
                    {selectedChat.isGroupChat && (
                      <button onClick={() => setShowUpdateModal(true)} className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-2 py-1 rounded-full text-xs transition">
                        ⚙️ Manage
                      </button>
                    )}
                  </div>

                  {/* --- 3 DOTS MENU --- */}
                  <div className="relative ml-auto">
                    <button
                      onClick={() => setShowMenu(!showMenu)}
                      className="text-gray-600 hover:text-blue-600 transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-2xl pb-2 font-bold"
                      title="Menu"
                    >
                      ⋮
                    </button>

                    {/* DROPDOWN BOX */}
                    {showMenu && (
                      <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-100 shadow-xl rounded-xl z-50 overflow-hidden flex flex-col">
                        <button
                          onClick={() => { setShowSearch(!showSearch); setShowMenu(false); }}
                          className="text-left px-4 py-2.5 hover:bg-slate-50 text-sm font-medium text-gray-700 border-b border-gray-50 flex items-center gap-2 transition"
                        >
                          🔍 Search
                        </button>
                        <button
                          onClick={() => { setIsSelectMode(true); setShowMenu(false); setSelectedMessages([]); }}
                          className="text-left px-4 py-2.5 hover:bg-slate-50 text-sm font-medium text-gray-700 flex items-center gap-2 transition"
                        >
                          ☑️ Select
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* --- ONLINE / OFFLINE TEXT LIKHA AAYEGA --- */}
                {!selectedChat.isGroupChat && (
                  <span className={`text-xs font-semibold mt-0.5 ${onlineUsers.includes(selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1]._id : selectedChat.users[0]._id) ? "text-green-500" : "text-gray-400"}`}>
                    {onlineUsers.includes(selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1]._id : selectedChat.users[0]._id) ? "Online" : "Offline"}
                  </span>
                )}

                {/* --- NAYA SEARCH INPUT FIELD --- */}
                {showSearch && (
                  <div className="mt-2 w-full pr-2 animate-pulse transition-all">
                    <input
                      type="text"
                      placeholder="Search in this conversation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full px-4 py-1.5 text-sm bg-slate-100 border-none rounded-full focus:outline-none focus:ring-1 focus:ring-blue-400 text-gray-700 shadow-inner"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* YAHAN SE REPLACE KARNA SHURU KAR */}
            {/* --- ACTION BAR (Select Mode) --- */}
            {isSelectMode && (
              <div className="w-full bg-blue-50 border-b border-blue-200 p-2 flex justify-between items-center shadow-sm z-10 px-4 transition-all">
                <span className="text-sm font-bold text-blue-700">{selectedMessages.length} selected</span>
                <div className="flex gap-2">
                  <button onClick={() => { setIsSelectMode(false); setSelectedMessages([]); }} className="px-3 py-1 bg-white text-gray-700 border border-gray-300 text-xs rounded-md font-bold hover:bg-gray-100 transition shadow-sm">Cancel</button>
                  <button onClick={deleteSelectedMessages} disabled={selectedMessages.length === 0} className={`px-3 py-1 text-white text-xs rounded-md font-bold transition shadow-sm ${selectedMessages.length > 0 ? "bg-red-500 hover:bg-red-600" : "bg-red-300 cursor-not-allowed"}`}>🗑️ Delete</button>
                </div>
              </div>
            )}
            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4"
              style={{
                // WhatsApp ka standard doodle pattern
                backgroundImage: "url('/doodle.png')",
                backgroundRepeat: "repeat",
                backgroundSize: "400px", // Pattern ka size
                backgroundColor: "#f1f5f9", // Tailwind slate-100 (Halka sa greyish base)
                backgroundBlendMode: "color-burn", // Magic trick: Pattern ko ekdum transparent aur soft banane ke liye
              }}
            >
              {messages.length > 0 ? (
                messages
                  .filter((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(m => (
                    // 🔥 1. YAHAN 'group' AUR 'relative' CLASS ADD KI HAI
                    <div key={m._id} className={`flex items-center gap-3 w-full my-1 group relative ${m.sender._id === userInfo._id ? "justify-end" : "justify-start"}`}>

                      {/* --- 1. CHECKBOX (Select Mode ke liye) --- */}
                      {isSelectMode && (
                        <input
                          type="checkbox"
                          className="w-4 h-4 cursor-pointer accent-blue-500 flex-shrink-0"
                          checked={selectedMessages.includes(m._id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedMessages([...selectedMessages, m._id]);
                            else setSelectedMessages(selectedMessages.filter(id => id !== m._id));
                          }}
                        />
                      )}

                      <div className={`flex flex-col relative ${m.sender._id === userInfo._id ? "items-end" : "items-start"}`}>

                        {selectedChat.isGroupChat && m.sender._id !== userInfo._id && (
                          <span className="text-xs text-gray-500 mb-1 ml-1">{m.sender.name}</span>
                        )}

                        <div className={`relative flex items-center ${m.sender._id === userInfo._id ? "flex-row-reverse" : "flex-row"}`}>

                          {/* --- MESSAGE BUBBLE --- */}
                          <div className={`px-3 py-2 sm:px-4 max-w-[85%] sm:max-w-[75%] shadow-md flex flex-col break-words ${m.sender._id === userInfo._id ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm" : "bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100"}`}>
                            {m.content.includes("res.cloudinary.com") ? (
                              m.content.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                                <img src={m.content} alt="chat-img" className="max-w-full sm:max-w-[250px] rounded-lg mt-1 cursor-pointer hover:opacity-90 transition object-cover shadow-sm" />
                              ) : (
                                <a href={m.content} target="_blank" rel="noopener noreferrer" className={`flex items-center gap-2 px-3 py-2 mt-1 rounded-lg transition text-sm font-bold shadow-sm border ${m.sender._id === userInfo._id ? "bg-blue-700 hover:bg-blue-800 text-white border-blue-500" : "bg-gray-100 hover:bg-gray-200 text-gray-800 border-gray-300"}`}>📄 View Document</a>
                              )
                            ) : (
                              <span className="text-sm md:text-base break-words">{m.content}</span>
                            )}

                            {/* --- TIME & DELETE & READ TICKS --- */}
                            <div className={`flex items-center gap-2 mt-1 self-end ${m.sender._id === userInfo._id ? "text-blue-200" : "text-gray-400"}`}>
                              <span className="text-[9px] font-bold">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {!isSelectMode && m.sender._id === userInfo._id && (
                                <button onClick={() => deleteMessage(m._id)} className="text-[10px] hover:text-red-300 hover:scale-125 transition-all" title="Delete for everyone">🗑️</button>
                              )}
                              {m.sender._id === userInfo._id && (
                                <span className="ml-1 text-[12px] font-bold tracking-tighter drop-shadow-sm">
                                  {m.readBy && m.readBy.length > 0 ? <span className="text-cyan-300">✓✓</span> : <span className="text-white/60">✓✓</span>}
                                </span>
                              )}
                            </div>
                            {/* --- 🔥 YAHAN DIKHENGE REACTIONS 🔥 --- */}
                            {m.reactions && m.reactions.length > 0 && (
                              <div className={`absolute bottom-[-12px] flex items-center gap-0.5 bg-white border border-gray-200 rounded-full px-1.5 py-0.5 shadow-sm text-xs z-10 ${m.sender._id === userInfo._id ? "left-2" : "right-2"}`}>
                                {m.reactions.map((r, i) => (
                                  <span key={i}>{r.emoji}</span>
                                ))}
                                {m.reactions.length > 1 && (
                                  <span className="text-[10px] text-gray-500 font-bold ml-1">{m.reactions.length}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* --- 🔥 NAYA: HOVER REACTION BUTTON & EMOJI PICKER 🔥 --- */}
                          {!isSelectMode && (
                            <div className={`relative mx-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>

                              {/* Smiley + Button */}
                              <button
                                onClick={() => setReactionPickerId(reactionPickerId === m._id ? null : m._id)}
                                className="text-gray-400 hover:text-gray-600 bg-white/80 backdrop-blur-sm rounded-full p-1.5 shadow-sm border border-gray-200 hover:scale-110 transition-transform flex items-center justify-center"
                                title="React"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line><path d="M16 19h6"></path><path d="M19 16v6"></path></svg>
                              </button>

                              {/* Emoji Picker Popup (Sirf tab dikhega jab state match hogi) */}
                              {reactionPickerId === m._id && (
                                <div className={`absolute top-[-50px] z-50 bg-white border border-gray-200 shadow-xl rounded-full px-3 py-2 flex items-center gap-3 ${m.sender._id === userInfo._id ? "right-0" : "left-0"}`}>
                                  {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleReaction(m._id, emoji)}
                                      className="hover:scale-150 transition-transform duration-200 text-xl"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  ))
              ) : <div className="flex items-center justify-center h-full"><p className="text-gray-500 font-medium bg-white px-6 py-2 rounded-full shadow-sm border border-gray-100">Say Hi to start the conversation! 👋</p></div>}

              {isTyping ? (
                <div className="flex justify-start mt-2">
                  <span className="px-5 py-2.5 bg-gray-200 text-gray-500 italic rounded-2xl rounded-tl-sm shadow-sm text-sm flex items-center gap-1">
                    typing<span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span><span className="animate-bounce delay-300">.</span>
                  </span>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            {/* --- INPUT BAR WITH ATTACHMENT ICON --- */}
            <div className="p-2 sm:p-4 bg-transparent mb-2 sm:mb-4 w-full max-w-full box-border">
              <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-200 px-1 sm:px-2 py-1 sm:py-2 w-full max-w-full overflow-hidden box-border">

                {/* 📎 Attachment Button */}
                <label className="cursor-pointer p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 transition hover:bg-gray-100 rounded-full flex-shrink-0">
                  <input
                    type="file"
                    accept="image/*,.pdf,.doc,.docx,.txt,.zip"
                    className="hidden"
                    onChange={(e) => handleFileMessage(e.target.files[0])}
                    disabled={imageLoading}
                  />
                  {imageLoading ? <span className="animate-spin inline-block">⏳</span> : <span className="text-lg sm:text-xl">📎</span>}
                </label>

                {/* 📷 Live Camera Button */}
                <button
                  onClick={startCamera}
                  className="p-1.5 sm:p-2 text-gray-500 hover:text-blue-600 transition hover:bg-gray-100 rounded-full flex-shrink-0 text-lg sm:text-xl"
                  disabled={imageLoading}
                  title="Open Camera"
                >
                  📷
                </button>

                {/* 🔥 THE MAGIC FIX: min-w-0 aur chota placeholder */}
                <input 
                  className="flex-1 min-w-0 px-2 py-1.5 sm:py-2 bg-transparent focus:outline-none text-gray-700 placeholder-gray-400 text-sm" 
                  value={newMessage} 
                  onChange={typingHandler} 
                  onKeyDown={sendMessage} 
                  placeholder="Message..." 
                  disabled={imageLoading} 
                />
                
                {/* Send Button */}
                <button 
                  onClick={() => sendMessage({ key: 'Enter' })} 
                  className="bg-blue-600 text-white font-semibold w-8 h-8 sm:w-10 sm:h-10 rounded-full hover:bg-blue-700 transition flex items-center justify-center flex-shrink-0 shadow-md ml-1"
                >
                  ➤
                </button>
              </div>
            </div>
            {/* YAHAN TAK REPLACE KARNA HAI */}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
              <h1 className="text-4xl text-blue-600 font-extrabold mb-4 tracking-tight">ChatNet</h1>
              <p className="text-gray-500 text-base font-medium">Select a user to start chatting real-time.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatpage;