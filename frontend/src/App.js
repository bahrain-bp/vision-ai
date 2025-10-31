import React, { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import Authentication from "./components/Authentication/Authentication";
import HomePage from "./components/HomePage/HomePage";
import SessionPage from "./components/Session/SessionPage";
import authService from "./services/authService";
import awsConfig from "./aws-config";
Amplify.configure(awsConfig);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState("home");
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      const result = await authService.getCurrentUser();
      if (result.success && result.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.log("No authenticated user found");
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = () => {
    checkAuthStatus();
  };

  const handleSignOut = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentView("home");
    setSessionData(null);
  };

  const handleStartSession = () => {
    // Generate new session data
    const newSessionData = {
      sessionId: `#${new Date().getFullYear()}-INV-${Math.floor(
        1000 + Math.random() * 9000
      )}`,
      investigator: "M. AlZebari",
      language: "Arabic",
      duration: "00:00",
      witness: "Not set",
      status: "Ready",
      witnessData: {
        fullName: "",
        idNumber: "",
      },
      identityData: {
        referencePhoto: null,
        isVerified: false,
      },
      translationSettings: {
        sourceLanguage: "ar",
        targetLanguage: "en",
      },
    };

    setSessionData(newSessionData);
    setCurrentView("session");
  };

  const handleEndSession = () => {
    setCurrentView("home");
    setSessionData(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading Vision AI...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {!isAuthenticated ? (
        <Authentication onAuthSuccess={handleAuthSuccess} />
      ) : currentView === "session" ? (
        <SessionPage
          user={currentUser}
          onSignOut={handleSignOut}
          sessionData={sessionData}
          onEndSession={handleEndSession}
        />
      ) : (
        <HomePage
          user={currentUser}
          onSignOut={handleSignOut}
          onStartSession={handleStartSession}
        />
      )}
    </div>
  );
}

export default App;
