import React, { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import Authentication from "./components/Authentication";
import HomePage from "./components/HomePage";
import authService from "./services/authService";
import awsConfig from "./aws-config";

// Configure Amplify
Amplify.configure(awsConfig);

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

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
      ) : (
        <HomePage user={currentUser} onSignOut={handleSignOut} />
      )}
    </div>
  );
}

export default App;
