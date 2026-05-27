import { Route, Routes } from "react-router-dom";
import Homepage from "./pages/Homepage";
import Chatpage from "./pages/Chatpage";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css"; // Yeh CSS toast ko sundar banayegi

function App() {
  return (
    <div className="App min-h-screen bg-gray-100 flex items-center justify-center">
      <Routes>
        {/* Jab URL '/' hoga toh Homepage dikhega */}
        <Route path="/" element={<Homepage />} />
        
        {/* Jab URL '/chats' hoga toh Chatpage dikhega */}
        <Route path="/chats" element={<Chatpage />} />
      </Routes>

      <ToastContainer 
        position="bottom-right" 
        autoClose={3000} 
        hideProgressBar={false} 
        newestOnTop={true} 
        closeOnClick 
        theme="colored" 
      />
    </div>
  );
}

export default App;