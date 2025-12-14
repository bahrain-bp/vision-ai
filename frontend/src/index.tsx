import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { Buffer } from "buffer";
import process from "process";
import { LanguageProvider } from "./context/LanguageContext";
 
window.Buffer = Buffer;
window.process = process;
 
const rootElement = document.getElementById("root");
 
if (!rootElement) {
  throw new Error("Failed to find the root element");
}
 
const root = ReactDOM.createRoot(rootElement);
 
root.render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>
);
 
reportWebVitals();