import mongoose from "mongoose";

const messageSchema = mongoose.Schema(
  {
    // Message kisne bheja?
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // Message mein kya likha hai?
    content: { type: String, trim: true },
    
    // Yeh message kis chat (group ya personal) ka hissa hai?
    chat: { type: mongoose.Schema.Types.ObjectId, ref: "Chat" },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;