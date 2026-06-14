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

// Online users track karne ke liye array
let onlineUsers = [];

io.on("connection", (socket) => {
  console.log("Connected to socket.io");

  // Jab user login/app kholta hai
  socket.on("setup", (userData) => {
    socket.join(userData._id);
    socket.emit("connected");

    // Check karo agar user pehle se list mein nahi hai, toh add karo
    if (!onlineUsers.some((user) => user.userId === userData._id)) {
      onlineUsers.push({ userId: userData._id, socketId: socket.id });
    }
    
    // Sab connected logo ko nayi list bhej do
    io.emit("get-online-users", onlineUsers.map((user) => user.userId)); 
  });

  // Jab chat open karta hai
  socket.on("join chat", (room) => {
    socket.join(room);
  });

  // REAL-TIME MESSAGE MAGIC
  socket.on("new message", (newMessageRecieved) => {
    var chat = newMessageRecieved.chat;
    if (!chat.users) return;

    chat.users.forEach((user) => {
      if (user._id == newMessageRecieved.sender._id) return;
      socket.in(user._id).emit("message received", newMessageRecieved);
    });
  });

  // --- NAYA SOCKET: DELETE MESSAGE KELIYE ---
  socket.on("delete message", (data) => {
    // Jis room (chat) me message delete hua hai, usme sabko bata do
    socket.in(data.room).emit("message deleted", data.messageId);
  });

  // --- TYPING EVENTS ---
  socket.on("typing", (room) => socket.in(room).emit("typing"));
  socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

  // --- Jab user app band karta hai ya tab close karta hai ---
  socket.on("disconnect", () => {
    // User ko online list se nikal do
    onlineUsers = onlineUsers.filter((user) => user.socketId !== socket.id);
    // Baki sabko updated list bhej do
    io.emit("get-online-users", onlineUsers.map((user) => user.userId));
  });
});

app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/message", messageRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));