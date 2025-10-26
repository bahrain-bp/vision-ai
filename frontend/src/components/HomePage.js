import React from "react";
import { LogOut } from "lucide-react";
import authService from "../services/authService";

const HomePage = ({ user, onSignOut }) => {
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
    <div>
      <div>
        <div>
          <h1>Successfully Signed In!</h1>
          <p>Welcome back, {user?.username || "User"}!</p>
        </div>

        <button onClick={handleSignOut}>
          <LogOut />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

export default HomePage;
