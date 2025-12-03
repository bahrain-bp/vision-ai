import React, { useState, useEffect } from "react";
import { Amplify } from "aws-amplify";
import Authentication from "./components/Authentication/Authentication";
import HomePage from "./components/HomePage/HomePage";
import SessionPage from "./components/Session/SessionPage";
import authService from "./services/authService";
import awsConfig from "./aws-config";
import { User } from "./types";
import { TranscriptionProvider } from "./context/TranscriptionContext";
import { CaseProvider } from "./context/CaseContext";
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'; 


Amplify.configure(awsConfig);

// --- TYPE DEFINITIONS ---

interface WitnessData {
  fullName: string;
  idNumber: string;
}

interface IdentityData {
  referencePhoto: string | null;
  isVerified: boolean;
}

interface TranslationSettings {
  sourceLanguage: string;
  targetLanguage: string;
}

export interface SessionData {
  sessionId: string;
  investigator: string;
  language: string;
  duration: string;
  witness: string;
  status: string;
  witnessData: WitnessData;
  identityData: IdentityData;
  translationSettings: TranslationSettings;
}

type ViewType = "home" | "session";

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>("home");
  const [sessionData, setSessionData] = useState<SessionData | null>(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async (): Promise<void> => {
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
    } catch (error: unknown) {
      console.log("No authenticated user found");
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (): void => {
    checkAuthStatus();
  };

  const handleSignOut = (): void => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    setCurrentView("home");
    setSessionData(null);
  };

  const handleStartSession = (): void => {
    const newSessionData: SessionData = {
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

  const handleEndSession = (): void => {
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
    <CaseProvider>
    <Router>
    <Routes>
      {/* Main app route */}
      <Route 
        path="/" 
        element={
      <div className="App">
        {!isAuthenticated ? (
          <Authentication onAuthSuccess={handleAuthSuccess} />
        ) : currentView === "session" && currentUser && sessionData ? (
          <TranscriptionProvider>
            <SessionPage
              user={currentUser}
              onSignOut={handleSignOut}
              //sessionData={sessionData}
              onEndSession={handleEndSession}
            />
          </TranscriptionProvider>
        ) : currentUser ? (
          <HomePage
            user={currentUser}
            onSignOut={handleSignOut}
            onStartSession={handleStartSession}
          />
        ) : null}
      </div>

        } 
      />
    </Routes>
  </Router>
  </CaseProvider>
  );
};

export default App;