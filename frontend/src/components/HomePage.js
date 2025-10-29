import React from "react";
import { LogOut, Play } from "lucide-react";
import authService from "../services/authService";

const HomePage = ({ user, onSignOut, onStartSession }) => {
  const handleSignOut = async () => {
    try {
      await authService.signOut();
      onSignOut();
    } catch (error) {
      console.error("Sign out error:", error);
      alert("Error signing out. Please try again.");
    }
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <div className="home-logo">
            <div className="home-logo-inner">V</div>
          </div>
          <h1 className="home-title">Successfully Signed In!</h1>
          <p className="home-subtitle">
            Welcome back, {user?.username || "User"}!
          </p>
        </div>

        <button onClick={onStartSession} className="session-button">
          <Play size={20} />
          <span>Start New Session</span>
        </button>

        <button onClick={handleSignOut} className="signout-button-home">
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default HomePage;