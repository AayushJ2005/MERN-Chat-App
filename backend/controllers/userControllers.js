import asyncHandler from "express-async-handler";
import User from "../models/userModel.js";
import generateToken from "../config/generateToken.js";
import transporter from "../config/nodemailer.js";

import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

// @description    Register new user (Direct, No OTP, No custom photo)
// @route          POST /api/user/
// @access         Public
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    res.status(400);
    throw new Error("Please enter all the fields");
  }

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error("User already exists");
  }

  // Yahan hum 'pic' nahi le rahe, toh MongoDB model mein jo default photo hai wahi lag jayegi
  const user = await User.create({
    name,
    email,
    password,
  });

  if (user) {
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

// @description    Google Login
// @route          POST /api/user/google-login
const googleLogin = asyncHandler(async (req, res) => {
  const { name, email, pic } = req.body;

  // Pehle check karo ki user pehle se database mein hai ya nahi
  let user = await User.findOne({ email });

  if (!user) {
    // Agar naya user hai, toh MongoDB mein create kar do
    user = await User.create({
      name,
      email,
      pic,
      password: Date.now().toString() + Math.random().toString(), // Random password
    });
  }

  // User ko token dekar login karwa do
  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    pic: user.pic,
    token: generateToken(user._id),
  });
});

export { registerUser, authUser, allUsers, updateUserProfile, googleLogin };