import React, { useState } from 'react';
import Login from '../components/Login';
import Signup from '../components/Signup';

const Homepage = () => {
  // Yeh state track karegi ki user Login dekh raha hai ya Sign Up
  const [activeTab, setActiveTab] = useState('login');

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg">
        
        {/* App Title */}
        <h1 className="text-3xl font-bold text-center text-blue-600 mb-6">
          MERN Chat App
        </h1>

        {/* Toggle Buttons (Login vs Sign Up) */}
        <div className="flex mb-6 bg-gray-200 rounded-lg p-1">
          <button
            className={`flex-1 py-2 rounded-md font-semibold transition-all ${
              activeTab === 'login' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('login')}
          >
            Login
          </button>
          <button
            className={`flex-1 py-2 rounded-md font-semibold transition-all ${
              activeTab === 'signup' ? 'bg-white shadow text-blue-600' : 'text-gray-500'
            }`}
            onClick={() => setActiveTab('signup')}
          >
            Sign Up
          </button>
        </div>

        {/* Content Area */}
        <div className="mt-4">
          {activeTab === 'login' ? (
            <Login />
          ) : (
            <Signup />
          )}
        </div>

      </div>
    </div>
  );
};

export default Homepage;