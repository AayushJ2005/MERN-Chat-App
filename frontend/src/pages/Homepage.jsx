import React from 'react';
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from 'react-toastify';

const Homepage = () => {
  const navigate = useNavigate();

  const handleGoogleAuth = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const config = { headers: { "Content-type": "application/json" } };

      // Seedha backend par bheja (Login aur Signup dono yahi handle kar lega)
      const { data } = await axios.post(
        "/api/user/google-login",
        {
          name: user.displayName,
          email: user.email,
          pic: user.photoURL,
        },
        config
      );

      localStorage.setItem("userInfo", JSON.stringify(data));
      toast.success("Welcome to MERN Chat! 🚀");
      navigate("/chats");

    } catch (error) {
      console.error("Auth Error:", error);
      toast.error("Google Authentication Failed.");
    }
  };

  return (
    <div className="fixed inset-0 w-full h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 flex items-center justify-center p-4 sm:p-8 overflow-hidden z-0">
      {/* NAYA UI: Glassmorphism Card */}
      <div className="relative z-10 bg-white/60 backdrop-blur-xl border border-white/50 p-10 rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col items-center text-center transition-all hover:shadow-indigo-500/20">

        {/* Logo/Icon Container */}
        <div className="bg-gradient-to-tr from-indigo-500 to-purple-500 p-4 rounded-full shadow-lg mb-6 animate-bounce delay-150 duration-1000">
          {/* Yahan tu apna koi custom logo bhi laga sakta hai */}
          <span className="text-4xl">💬</span>
        </div>

        {/* NAYA NAAM YAHAN LIKH */}
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600 mb-3 tracking-tight">
          ChatNet
        </h1>

        <p className="text-gray-600 font-medium mb-10 text-sm sm:text-base leading-relaxed px-4">
          Connect with your friends instantly, seamlessly, and securely in real-time.
        </p>

        {/* TERA GOOGLE BUTTON YAHAN AAYEGA */}
        <div className="w-full flex justify-center hover:scale-105 transition-transform duration-300">

          {/* Apne aslee Google Login Button ka code iske andar rakh de */}
          <button onClick={handleGoogleAuth} className="w-full bg-white border border-gray-200 text-gray-700 font-semibold py-3 px-4 rounded-xl shadow-sm hover:bg-gray-50 hover:shadow-md flex items-center justify-center gap-3 transition-all">
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="google" className="w-5 h-5" />
            Continue with Google
          </button>

        </div>

      </div>

      {/* Decorative Background Elements */}
      {/* Decorative Background Elements */}
      <div className="fixed top-20 left-20 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob pointer-events-none -z-10"></div>
      <div className="fixed bottom-20 right-20 w-64 h-64 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000 pointer-events-none -z-10"></div>
    </div>
  );
};

export default Homepage;