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
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md bg-white p-10 rounded-3xl shadow-xl flex flex-col items-center border border-gray-100">
        
        {/* App Logo / Title */}
        <div className="bg-blue-50 p-4 rounded-full mb-4">
          <span className="text-4xl">💬</span>
        </div>
        <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight mb-2">
          MERN Chat
        </h1>
        <p className="text-gray-500 mb-10 text-center font-medium text-sm">
          Connect with your friends instantly, seamlessly, and securely.
        </p>

        {/* Single Premium Google Button */}
        <button
          onClick={handleGoogleAuth}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 text-gray-700 font-bold text-base py-3.5 rounded-xl hover:bg-gray-50 hover:shadow-md transition-all active:scale-95"
        >
          <img 
            src="https://www.svgrepo.com/show/475656/google-color.svg" 
            className="w-6 h-6" 
            alt="Google" 
          />
          Continue with Google
        </button>

      </div>
    </div>
  );
};

export default Homepage;