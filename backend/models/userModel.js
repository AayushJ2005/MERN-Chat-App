import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    pic: {
      type: String,
      default: "https://icon-library.com/images/anonymous-avatar-icon/anonymous-avatar-icon-25.jpg",
    },
  },
  { timestamps: true }
);

// 1. Password Match karne ka method (Login ke waqt chalega)
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// 2. Password ko Hash karne ka logic (Signup ke waqt chalega)
userSchema.pre("save", async function () {
  // Agar password modify nahi hua hai, toh chup-chaap yahan se wapas laut jao (return)
  if (!this.isModified("password")) {
    return; 
  }

  // Agar naya password set ho raha hai, toh usko encrypt (hash) karo
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model("User", userSchema);
export default User;