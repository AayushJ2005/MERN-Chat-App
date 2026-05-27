import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify'; // NAYA IMPORT 🚀

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate(); // Page change karne ke liye tool

  const submitHandler = async (e) => {
    e.preventDefault(); 
    
    // 1. Khali fields check karna (Agar user bina bhare submit kare)
    if (!email || !password) {
      toast.warning("Bhai, email aur password dono daalna zaroori hai!", { position: "top-center" });
      return;
    }

    try {
      // 2. Postman ki tarah JSON format batana
      const config = {
        headers: {
          "Content-type": "application/json",
        },
      };

      // 3. Backend API ko hit karna
      const { data } = await axios.post(
        "/api/user/login",
        { email, password },
        config
      );
      
      // 4. Success milne par toast dikhana!
      toast.success("Login Successful! 🎉", { position: "bottom-right" });
      
      // 5. User ka VIP Pass (Token) aur details browser mein save karna
      localStorage.setItem("userInfo", JSON.stringify(data));
      
      // 6. Thoda delay dekar Chat page par bhej dena taaki notification dikh jaye
      setTimeout(() => {
        navigate("/chats");
      }, 1500);

    } catch (error) {
      // 7. Agar backend se error aaye (galat password)
      toast.error(error.response?.data?.message || "Invalid Email or Password ❌", { position: "bottom-right" });
    }
  };

  return (
    <form onSubmit={submitHandler} className="flex flex-col gap-4">
      <div>
        <label className="block text-gray-700 font-medium mb-1">Email</label>
        <input 
          type="email" 
          value={email} 
          onChange={(e) => setEmail(e.target.value)} 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Enter your email" 
        />
      </div>
      
      <div>
        <label className="block text-gray-700 font-medium mb-1">Password</label>
        <input 
          type="password" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Enter password" 
        />
      </div>

      <button 
        type="submit" 
        className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 mt-2 shadow-md"
      >
        Login
      </button>
    </form>
  );
};

export default Login;