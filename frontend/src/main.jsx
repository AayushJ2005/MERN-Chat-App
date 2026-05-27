import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// 1. Yeh line humne add ki router laane ke liye
import { BrowserRouter } from 'react-router-dom' 

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 2. App ko BrowserRouter se cover kar diya */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)