import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import generateToken from "../config/generateToken.js";
import transporter from "../config/nodemailer.js";

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

const otpStore = new Map();

// @description     Step 1: Send OTP to Email
// @route           POST /api/user/send-otp
// @access          Public
const sendOTP = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }

  // 1. Check karna ki user pehle se toh nahi hai
  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error("User already exists with this email");
  }

  // 2. 6-digit ka random OTP generate karna
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // 3. User ka data aur OTP memory mein save karna (jab tak verify na ho)
  otpStore.set(email, { name, email, password, otp });

  // 4. Email bhejne ka format
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "MERN Chat App - Verification OTP",
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>Welcome to MERN Chat, ${name}! 🚀</h2>
        <p>To complete your registration, please enter the following OTP:</p>
        <h1 style="color: #2563eb; letter-spacing: 5px;">${otp}</h1>
        <p>This OTP is valid for a short time. Do not share it with anyone.</p>
      </div>
    `,
  };

  try {
    // Email Bhejo!
    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "OTP sent successfully to your email" });
  } catch (error) {
    console.error("Email Error:", error);
    res.status(500);
    throw new Error("Error sending email. Please check your App Password.");
  }
});

// @description     Step 2: Verify OTP and Save User
// @route           POST /api/user/verify-otp
// @access          Public
const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // 1. Memory se user ka data nikalna
  const storedData = otpStore.get(email);

  if (!storedData) {
    res.status(400);
    throw new Error("OTP expired or not found. Please signup again.");
  }

  // 2. OTP match karna (Space aur Type dono ki problem solve)
  if (String(storedData.otp).trim() !== String(otp).trim()) {
    res.status(400);
    throw new Error("Invalid OTP ❌");
  }

  // 3. OTP sahi hai! Ab database mein asli user create karo
  const user = await User.create({
    name: storedData.name,
    email: storedData.email,
    password: storedData.password, // Password database mein hash hoga (userModel pre-save ke through)
  });

  if (user) {
    // Kaam hone ke baad memory se data hata do
    otpStore.delete(email);

    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error("Failed to create the user");
  }
});

// @description     Auth the user & get token (Login)
// @route           POST /api/user/login
const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // 1. Database mein user ko uske email se dhundho
  const user = await User.findOne({ email });

  // 2. Agar user mil gaya AUR uska password match ho gaya
  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      pic: user.pic,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error("Invalid Email or Password");
  }
});


// Database mein users ko dhundhne ke liye (khud ko chhod kar)
const allUsers = async (req, res) => {
  try {
    const keyword = req.query.search
      ? {
          $or: [
            { name: { $regex: req.query.search, $options: "i" } },
            { email: { $regex: req.query.search, $options: "i" } },
          ],
        }
      : {};

    // YAHAN HAI ASLI MAGIC: $ne (Not Equal) current user ki ID ko filter kar dega
    const users = await User.find(keyword).find({ _id: { $ne: req.user._id } });
    
    res.send(users);
    
  } catch (error) {
    res.status(500).json({ message: "Search karne mein error aayi", error });
  }
};

// @description     Update User Profile (Name & Photo)
// @route           PUT /api/user/profile
// @access          Protected
const updateUserProfile = asyncHandler(async (req, res) => {
  // req.user._id humein 'protect' middleware se mil jayega
  const user = await User.findById(req.user._id);

  if (user) {
    // Agar user ne naya naam ya photo bheji hai, toh update karo, warna purani hi rehne do
    user.name = req.body.name || user.name;
    user.pic = req.body.pic || user.pic;

    const updatedUser = await user.save();

    // Naya data frontend ko wapas bhej do
    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      pic: updatedUser.pic,
      token: generateToken(updatedUser._id), 
    });
  } else {
    res.status(404);
    throw new Error("User not found");
  }
});

export { sendOTP, verifyOTP, authUser, allUsers, updateUserProfile };