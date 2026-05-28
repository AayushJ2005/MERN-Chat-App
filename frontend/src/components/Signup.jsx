import React, { useState } from "react";
import axios from "axios";
import { auth, provider } from "../firebase";
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom";

const Signup = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // --- NAYA: Direct Signup Logic (No OTP, No Photo) ---
  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    if (!name || !email || !password || !confirmPassword) {
      alert("Please fill all the fields!");
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match!");
      setLoading(false);
      return;
    }

    try {
      const config = { headers: { "Content-type": "application/json" } };
      
      // Seedha backend ke naye register route par bheja
      const { data } = await axios.post("/api/user", { name, email, password }, config);
      
      alert("Registration Successful! 🚀");
      localStorage.setItem("userInfo", JSON.stringify(data));
      setLoading(false);
      navigate("/chats");
      
    } catch (error) {
      alert(error.response?.data?.message || "Error occurred!");
      setLoading(false);
    }
  };

  // --- Google Signup Logic ---
  const handleGoogleSignup = async (e) => {
    e.preventDefault();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const config = { headers: { "Content-type": "application/json" } };
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
      alert("Google Signup Successful! 🚀");
      navigate("/chats");
    } catch (error) {
      console.error("Google Signup Error:", error);
      alert("Google se signup nahi ho paya.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      <form onSubmit={submitHandler} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        
        <div>
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            style={{ width: "100%", padding: "8px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={{ width: "100%", padding: "8px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            style={{ width: "100%", padding: "8px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }}
          />
        </div>

        <div>
          <label>Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm your password"
            style={{ width: "100%", padding: "8px", marginTop: "5px", borderRadius: "5px", border: "1px solid #ccc" }}
          />
        </div>

        {/* Photo upload wala input hamesha ke liye uda diya */}

        <button 
          type="submit" 
          disabled={loading}
          style={{ width: "100%", backgroundColor: "#2563eb", color: "white", padding: "10px", borderRadius: "5px", border: "none", cursor: "pointer", marginTop: "10px" }}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
      </form>

      <button 
        onClick={handleGoogleSignup} 
        style={{ width: "100%", backgroundColor: "#DB4437", color: "white", padding: "10px", borderRadius: "5px", border: "none", cursor: "pointer", fontWeight: "bold" }}
      >
        Sign up with Google
      </button>
    </div>
  );
};

export default Signup;