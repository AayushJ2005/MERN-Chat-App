import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';

const Signup = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Naye states OTP ke liye
  const [otp, setOtp] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false); // Check karega ki OTP bhej diya ya nahi

  const navigate = useNavigate();

  // STEP 1: Details bhejna aur OTP mangwana
  const submitDetailsHandler = async (e) => {
    e.preventDefault();
    
    if (!name || !email || !password || !confirmPassword) {
      toast.warning("Bhai, saare fields bharne zaroori hain!");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords match nahi kar rahe!");
      return;
    }

    try {
      const config = { headers: { "Content-type": "application/json" } };

      // Naya route use kar rahe hain: /api/user/send-otp
      await axios.post("/api/user/send-otp", { name, email, password }, config);

      toast.success("OTP sent to your email! 📩");
      setIsOtpSent(true); // Isse form change hoke OTP wala box aa jayega

    } catch (error) {
      toast.error(error.response?.data?.message || "Error sending OTP!");
    }
  };

  // STEP 2: OTP Verify karna aur Final Register karna
  const verifyOtpHandler = async (e) => {
    e.preventDefault();

    if (!otp) {
      toast.warning("Bhai, pehle OTP toh daal!");
      return;
    }

    try {
      const config = { headers: { "Content-type": "application/json" } };

      // OTP verify karne wala route
      const { data } = await axios.post("/api/user/verify-otp", { email, otp }, config);

      toast.success("Registration Successful! 🎉 Welcome!");

      // User ka token save karna
      localStorage.setItem("userInfo", JSON.stringify(data));
      
      setTimeout(() => {
        navigate('/chats'); 
      }, 1500);

    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP ❌");
    }
  };

  return (
    <div>
      {/* Agar OTP nahi bheja hai, toh normal form dikhao */}
      {!isOtpSent ? (
        <form onSubmit={submitDetailsHandler} className="flex flex-col gap-3">
          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm">Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your name" />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Enter your email" />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Create a password" />
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm">Confirm Password</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Confirm your password" />
          </div>

          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700 transition duration-200 mt-2 shadow-md">
            Send OTP
          </button>
        </form>
      ) : (
        // Agar OTP bhej diya hai, toh yeh wala form dikhao
        <form onSubmit={verifyOtpHandler} className="flex flex-col gap-4 animate-pulse-once">
          <div className="bg-blue-50 p-4 rounded-md border border-blue-100 text-center">
            <p className="text-sm text-blue-800 font-medium">
              We've sent a 6-digit code to <br/><span className="font-bold">{email}</span>
            </p>
          </div>

          <div>
            <label className="block text-gray-700 font-medium mb-1 text-sm text-center">Enter OTP</label>
            <input 
              type="text" 
              value={otp} 
              onChange={(e) => setOtp(e.target.value)} 
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-2xl tracking-widest font-bold" 
              placeholder="------" 
              maxLength="6"
            />
          </div>

          <button type="submit" className="w-full bg-green-600 text-white font-bold py-2 px-4 rounded-md hover:bg-green-700 transition duration-200 shadow-md">
            Verify & Register
          </button>

          <button 
            type="button" 
            onClick={() => setIsOtpSent(false)} 
            className="text-sm text-gray-500 hover:text-blue-600 underline text-center"
          >
            Wrong email? Go back
          </button>
        </form>
      )}
    </div>
  );
};

export default Signup;