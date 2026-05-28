import React, { useState } from "react";
import axios from "axios";
import { auth, provider } from "../firebase"; // Path check kar lena agar firebase.js kisi aur folder mein hai
import { signInWithPopup } from "firebase/auth";
import { useNavigate } from "react-router-dom"; // Agar purana react-router hai toh useHistory use karna

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // history = useHistory() if v5

  // --- Normal Email/Password Login Logic ---
  const submitHandler = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (!email || !password) {
      alert("Please fill all the fields!");
      setLoading(false);
      return;
    }
    try {
      const config = { headers: { "Content-type": "application/json" } };
      const { data } = await axios.post("/api/user/login", { email, password }, config);
      alert("Login Successful! 🚀");
      localStorage.setItem("userInfo", JSON.stringify(data));
      setLoading(false);
      navigate("/chats"); // history.push("/chats") if v5
    } catch (error) {
      alert("Invalid Email or Password ❌");
      setLoading(false);
    }
  };

  // --- NAYA: Google Login Logic ---
  const handleGoogleLogin = async (e) => {
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
      alert("Google Login Successful! 🚀");
      navigate("/chats");
    } catch (error) {
      console.error("Google Login Error:", error);
      alert("Google se login nahi ho paya.");
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      <form onSubmit={submitHandler} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        
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

        <button 
          type="submit" 
          disabled={loading}
          style={{ width: "100%", backgroundColor: "#2563eb", color: "white", padding: "10px", borderRadius: "5px", border: "none", cursor: "pointer", marginTop: "10px" }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      {/* --- NAYA: Google Login Button --- */}
      <button 
        onClick={handleGoogleLogin} 
        style={{ width: "100%", backgroundColor: "#DB4437", color: "white", padding: "10px", borderRadius: "5px", border: "none", cursor: "pointer", fontWeight: "bold" }}
      >
        Sign in with Google
      </button>
    </div>
  );
};

export default Login;