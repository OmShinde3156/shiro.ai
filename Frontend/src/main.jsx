import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import 'katex/dist/katex.min.css';
import { ContextProvider } from './context/Context.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { BrowserRouter } from 'react-router-dom';

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <ThemeProvider>
      <ContextProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ContextProvider>
    </ThemeProvider>
  </BrowserRouter>
);


