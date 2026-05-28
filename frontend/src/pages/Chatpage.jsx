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

  const [typing, setTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // --- ONLINE USERS ---
  const [onlineUsers, setOnlineUsers] = useState([]);

  // --- GROUP CHAT STATES ---
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupChatName, setGroupChatName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [groupSearch, setGroupSearch] = useState("");
  const [groupSearchResult, setGroupSearchResult] = useState([]);

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

  useEffect(() => {
    if (userInfo) {
      setEditName(userInfo.name);
      setPic(userInfo.pic);
      socket = io(ENDPOINT);
      socket.emit("setup", userInfo);

      socket.on("typing", () => setIsTyping(true));
      socket.on("stop typing", () => setIsTyping(false));

      socket.on("get-online-users", (users) => {
        setOnlineUsers(users);
      });
    }
    return () => { if (socket) socket.disconnect(); };
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
      socket.emit("join chat", selectedChat._id);
    } catch (error) { console.error("Error fetching messages"); }
  };

  useEffect(() => { fetchMessages(); }, [selectedChat]);

  // --- SOCKET LISTENER: NOTIFICATIONS & PUSH TO TOP ---
  useEffect(() => {
    const messageListener = (newMessageRecieved) => {
      // 1. Agar chat open nahi hai, toh notification array me daalo
      if (!selectedChat || selectedChat._id !== newMessageRecieved.chat._id) {
        if (!notification.includes(newMessageRecieved)) {
          setNotification([newMessageRecieved, ...notification]);
        }
      } else {
        // Agar chat open hai, toh screen par message dikhao
        setMessages((prevMessages) => [...prevMessages, newMessageRecieved]);
      }

      // 2. Chat ko utha kar list mein Number 1 (Top) par daalo
      setChats((prevChats) => {
        const chatIndex = prevChats.findIndex((c) => c._id === newMessageRecieved.chat._id);
        
        if (chatIndex !== -1) {
          const chatToMove = prevChats[chatIndex];
          chatToMove.latestMessage = newMessageRecieved; // Sidebar ka text update karo
          const otherChats = prevChats.filter((c) => c._id !== newMessageRecieved.chat._id);
          return [chatToMove, ...otherChats]; // Top par chipka diya
        } else {
          return [newMessageRecieved.chat, ...prevChats];
        }
      });
    };

    socket.on("message received", messageListener);
    return () => socket.off("message received", messageListener);
  }, [selectedChat, notification]); 

  const typingHandler = (e) => {
    setNewMessage(e.target.value);
    if (!selectedChat) return;
    if (!typing) { setTyping(true); socket.emit("typing", selectedChat._id); }
    let lastTypingTime = new Date().getTime();
    var timerLength = 3000;
    setTimeout(() => {
      var timeNow = new Date().getTime();
      var timeDiff = timeNow - lastTypingTime;
      if (timeDiff >= timerLength && typing) {
        socket.emit("stop typing", selectedChat._id);
        setTyping(false);
      }
    }, timerLength);
  };

  const sendMessage = async (event) => {
    if (event.key === "Enter" && newMessage) {
      socket.emit("stop typing", selectedChat._id);
      try {
        const config = { headers: { "Content-type": "application/json", Authorization: `Bearer ${userInfo.token}` } };
        const messageToSend = newMessage;
        setNewMessage(""); // Input clear karo
        
        const { data } = await axios.post("/api/message", { content: messageToSend, chatId: selectedChat._id }, config);
        
        socket.emit("new message", data);
        setMessages([...messages, data]);

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

      user1._id === userInfo._id ? setSelectedChat() : setSelectedChat(data);
      setChats(chats.map((c) => (c._id === data._id ? data : c)));
      toast.success(isLeaving ? "You left the group." : `${user1.name} removed!`);
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

  return (
    <div className="flex h-screen w-full bg-gray-100 overflow-hidden font-sans relative">

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
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
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
                    
                    {/* --- BOLD TEXT HIGHIGHT --- */}
                    <p className={`text-xs truncate mt-0.5 ${unreadCount > 0 ? 'text-gray-800 font-bold' : 'text-gray-500'}`}>
                      {c.latestMessage ? c.latestMessage.content : "Start chatting..."}
                    </p>
                  </div>
                </div>
              );
            })
          ) : <div className="flex flex-col items-center justify-center h-full text-gray-400"><p className="mt-4 text-sm font-medium">No chats yet.</p><p className="text-xs">Search for a user to start!</p></div>}
        </div>
      </div>

      {/* ---------------- RIGHT CHAT WINDOW ---------------- */}
      <div className="flex-1 flex flex-col bg-slate-50 relative">
        {selectedChat ? (
          <>
            <div className="p-4 bg-white/80 backdrop-blur-md border-b border-gray-200 shadow-sm flex items-center gap-4 sticky top-0 z-10">
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

              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-gray-800 tracking-wide leading-tight">
                  {selectedChat.isGroupChat ? selectedChat.chatName : (selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1].name : selectedChat.users[0].name)}
                </h2>
                {selectedChat.isGroupChat && (
                  <button onClick={() => setShowUpdateModal(true)} className="ml-3 bg-gray-100 hover:bg-gray-200 text-gray-600 p-1.5 rounded-full text-xs transition">
                    ⚙️ Manage
                  </button>
                )}
                {!selectedChat.isGroupChat && onlineUsers.includes(selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1]._id : selectedChat.users[0]._id) && (
                  <span className="text-xs text-green-500 font-semibold">Online</span>
                )}
              </div>
            </div>

            <div className="flex-1 p-6 overflow-y-auto flex flex-col gap-4">
              {messages.length > 0 ? (
                messages.map(m => (
                  <div key={m._id} className={`flex ${m.sender._id === userInfo._id ? "justify-end" : "justify-start"} flex-col ${m.sender._id === userInfo._id ? "items-end" : "items-start"}`}>
                    {selectedChat.isGroupChat && m.sender._id !== userInfo._id && (
                      <span className="text-xs text-gray-500 mb-1 ml-1">{m.sender.name}</span>
                    )}
                    <span className={`px-5 py-2.5 max-w-[70%] break-words shadow-md text-sm md:text-base ${m.sender._id === userInfo._id ? "bg-blue-600 text-white rounded-2xl rounded-tr-sm" : "bg-white text-gray-800 rounded-2xl rounded-tl-sm border border-gray-100"}`}>
                      {m.content}
                    </span>
                  </div>
                ))
              ) : <div className="flex items-center justify-center h-full"><p className="text-gray-500 font-medium bg-white px-6 py-2 rounded-full shadow-sm border border-gray-100">Say Hi to start the conversation! 👋</p></div>}

              {isTyping ? (
                <div className="flex justify-start">
                  <span className="px-5 py-2.5 bg-gray-200 text-gray-500 italic rounded-2xl rounded-tl-sm shadow-sm text-sm flex items-center gap-1">
                    typing<span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span><span className="animate-bounce delay-300">.</span>
                  </span>
                </div>
              ) : null}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-transparent mb-2">
              <div className="flex items-center bg-white rounded-full shadow-lg border border-gray-200 px-2 py-2">
                <input className="flex-1 px-4 py-2 bg-transparent focus:outline-none text-gray-700 placeholder-gray-400" value={newMessage} onChange={typingHandler} onKeyDown={sendMessage} placeholder="Type a message and press Enter..." />
                <button onClick={() => sendMessage({ key: 'Enter' })} className="bg-blue-600 text-white font-semibold w-10 h-10 rounded-full hover:bg-blue-700 transition flex items-center justify-center flex-shrink-0 shadow-md">➤</button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center h-full bg-slate-50">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 flex flex-col items-center">
              <h1 className="text-4xl text-blue-600 font-extrabold mb-4 tracking-tight">MERN Chat</h1>
              <p className="text-gray-500 text-base font-medium">Select a user to start chatting real-time.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatpage;