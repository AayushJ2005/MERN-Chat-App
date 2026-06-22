import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import userRoutes from "./routes/userRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

dotenv.config();
connectDB({ family: 4 });

const app = express();
app.use(express.json());

// Express API ke liye CORS (BINA SLASH KE)
// Express API ke liye CORS (BINA SLASH KE)
app.use(cors({
  origin: ["https://mern-chat-app-umber-phi.vercel.app", "http://localhost:5173", "https://chatnet-app.vercel.app"]
}));

const server = createServer(app);

// Socket.io ka setup (BINA SLASH KE)
const io = new Server(server, {
  pingTimeout: 60000,
  cors: {
    origin: ["https://mern-chat-app-umber-phi.vercel.app", "http://localhost:5173", "https://chatnet-app.vercel.app"],
    credentials: true,
  },
});

// Global array
// --- NAYA BULLETPROOF LOGIC: Ab hum har tab (socket) ko track karenge ---
const userSocketMap = new Map();

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  // 1. JAB KOI NAYA TAB KHULEGA
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");

    // NAYA: Is specific socket (tab) ko user ki ID assign karo Map ke andar
    userSocketMap.set(socket.id, userData._id);

    // NAYA: Set ka use karke duplicate IDs hatao (taaki list mein ek naam ek hi baar aaye)
    const uniqueOnlineUsers = [...new Set(userSocketMap.values())];
    io.emit("get-online-users", uniqueOnlineUsers);
  });

  // 2. JAB KOI TAB BAND HOGA YA REFRESH HOGA
  socket.on("disconnect", () => {
    console.log("User disconnected");

    // NAYA: Sirf is tab ka socket delete karo, poora user nahi!
    userSocketMap.delete(socket.id);

    // NAYA: Baaki bache huye users ki nayi list sabko bhejo
    const uniqueOnlineUsers = [...new Set(userSocketMap.values())];
    io.emit("get-online-users", uniqueOnlineUsers);
  });

  // 👇 TERE PURANE STABLE EVENTS 👇
  socket.on("join chat", (room) => {
    socket.join(room);
  });

  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;
    if (!chat.users) return console.log("chat.users not defined");

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;
      socket.in(user._id).emit("message received", newMessageRecieved);
    });
  });

  socket.on("delete message", ({ messageId, room }) => {
    socket.in(room).emit("message deleted", messageId);
  });

  // --- NAYA REACTION SOCKET LOGIC ---
  socket.on("new reaction", (reactionData) => {
    // reactionData mein humein messageId, emoji, aur chatId milegi
    socket.in(reactionData.chatId).emit("message reacted", reactionData);
  });

}); // io.on connection yahan khatam

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));