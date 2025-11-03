import React from "react";
import { LogOut, Play } from "lucide-react";
import authService from "../../services/authService";
import { User } from "../../types/";

// --- TYPE DEFINITIONS ---

interface HomePageProps {
  user: User | null;
  onSignOut: () => void;
  onStartSession: () => void;
}

// --- HOMEPAGE COMPONENT ---

const HomePage: React.FC<HomePageProps> = ({
  user,
  onSignOut,
  onStartSession,
}) => {
  const handleSignOut = async (): Promise<void> => {
    try {
      await authService.signOut();
      onSignOut();
    } catch (error: unknown) {
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