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

  // --- NAYA STATE: Online Users ke liye ---
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
  const [picLoading, setPicLoading] = useState(false); 

  const messagesEndRef = useRef(null);
  const navigate = useNavigate(); 
  const userInfo = JSON.parse(localStorage.getItem('userInfo'));

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]); 

  const logoutHandler = () => {
    localStorage.removeItem("userInfo");
    if(socket) socket.disconnect(); 
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

      // --- NAYA LOGIC: Backend se online users ki list lena ---
      socket.on("get-online-users", (users) => {
        setOnlineUsers(users);
      });
    }
    return () => { if(socket) socket.disconnect(); };
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

  useEffect(() => {
    const messageListener = (newMessageRecieved) => {
      if (selectedChat && selectedChat._id === newMessageRecieved.chat._id) {
        setMessages((prevMessages) => [...prevMessages, newMessageRecieved]);
      }
    };
    socket.on("message received", messageListener);
    return () => socket.off("message received", messageListener);
  }, [selectedChat]); 

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
        setNewMessage(""); 
        const { data } = await axios.post("/api/message", { content: messageToSend, chatId: selectedChat._id }, config);
        socket.emit("new message", data);
        setMessages([...messages, data]);
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

  const postDetails = (pics) => {
    setPicLoading(true);
    if (pics === undefined) {
      toast.warning("Please select an image!");
      setPicLoading(false);
      return;
    }
    
    if (pics.type === "image/jpeg" || pics.type === "image/png" || pics.type === "image/webp") {
      const data = new FormData();
      data.append("file", pics);
      data.append("upload_preset", "gklrlsyz"); // YAHAN APNA PRESET NAAM DAAL
      data.append("cloud_name", "dkjuexjmp"); // YAHAN APNA CLOUD NAAM DAAL
      
      fetch("https://api.cloudinary.com/v1_1/dkjuexjmp/image/upload", {
        method: "post",
        body: data,
      })
        .then((res) => res.json())
        .then((data) => {
          setPic(data.url.toString()); 
          setPicLoading(false);
          toast.success("Image uploaded to Cloudinary! Now click Save.");
        })
        .catch((err) => {
          console.log(err);
          setPicLoading(false);
          toast.error("Error uploading image");
        });
    } else {
      toast.warning("Please select JPEG or PNG format");
      setPicLoading(false);
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
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => postDetails(e.target.files[0])}
                className="mt-4 w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
              />
              {picLoading && <p className="text-xs text-blue-500 mt-2 animate-pulse">Uploading Image to Cloud... Wait</p>}
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
              disabled={picLoading}
              className={`w-full text-white font-bold py-3 mt-4 rounded-xl transition shadow-lg ${picLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
            >
              {picLoading ? "Please Wait..." : "Save Changes"}
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

      {/* ---------------- LEFT SIDEBAR ---------------- */}
      <div className="w-1/3 bg-white border-r border-gray-200 flex flex-col shadow-sm z-10">
        <div className="p-4 border-b border-gray-100 bg-gray-50">
          
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-extrabold text-gray-800 tracking-tight">Chats</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowGroupModal(true)} className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-md text-sm font-bold transition-colors border border-blue-200 shadow-sm hidden md:block">
                + Group
              </button>

              <div className="relative">
                <img 
                  src={userInfo?.pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"} 
                  alt="Profile" 
                  className="w-10 h-10 rounded-full cursor-pointer border-2 border-transparent hover:border-blue-500 object-cover shadow-sm transition-all"
                  onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                />
                
                {isProfileMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl z-50 border border-gray-100 py-2 overflow-hidden animate-fade-in">
                    <button onClick={() => { setIsProfileMenuOpen(false); setShowProfileModal(true); }} className="block w-full text-left px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      👤 My Profile
                    </button>
                    <div className="border-t border-gray-100 my-1"></div>
                    <button onClick={logoutHandler} className="block w-full text-left px-5 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors">
                      🚪 Logout
                    </button>
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
                    <img src={u.pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg"} className="w-12 h-12 rounded-full object-cover border border-gray-200" alt="pic"/>
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
              const chatPic = c.isGroupChat ? "https://cdn-icons-png.flaticon.com/512/166/166258.png" : (otherUser.pic || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg");
              
              return (
                <div key={c._id} onClick={() => setSelectedChat(c)} className={`p-4 border-b border-gray-50 cursor-pointer flex items-center gap-4 transition-colors ${selectedChat?._id === c._id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}>
                  {/* Avatar with Green Dot Logic */}
                  <div className="relative">
                    <img src={chatPic} className="w-12 h-12 rounded-full object-cover border border-gray-200" alt="pic"/>
                    {!c.isGroupChat && onlineUsers.includes(otherUser._id) && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 overflow-hidden"><p className="font-semibold text-gray-800 text-base">{chatNameDisplay}</p><p className="text-xs text-gray-500 truncate mt-0.5">{c.latestMessage ? c.latestMessage.content : "Start chatting..."}</p></div>
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
              {/* Header Avatar with Green Dot Logic */}
              <div className="relative">
                <img 
                  src={selectedChat.isGroupChat ? "https://cdn-icons-png.flaticon.com/512/166/166258.png" : ((selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1].pic : selectedChat.users[0].pic) || "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg")} 
                  className="w-10 h-10 rounded-full object-cover border border-gray-200" 
                  alt="pic" 
                />
                {!selectedChat.isGroupChat && onlineUsers.includes(selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1]._id : selectedChat.users[0]._id) && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                )}
              </div>
              
              <div className="flex flex-col">
                <h2 className="text-lg font-bold text-gray-800 tracking-wide leading-tight">
                  {selectedChat.isGroupChat ? selectedChat.chatName : (selectedChat.users[0]._id === userInfo._id ? selectedChat.users[1].name : selectedChat.users[0].name)}
                </h2>
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