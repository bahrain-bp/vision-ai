import React, { useState, useEffect } from "react";
import "../index.css";
import {
  LogIn,
  UserPlus,
  MailCheck,
  Loader,
  Lock,
  AtSign,
  Key,
  Home,
  Eye,
} from "lucide-react";
import authService from "../services/authService";

// --- REUSABLE COMPONENTS ---
const Button = ({ children, onClick, loading, icon: Icon, className = "" }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className={`button ${
      loading ? "button-loading" : "button-normal"
    } ${className}`}
  >
    {loading ? (
      <Loader className="spinner" />
    ) : (
      <>
        {Icon && <Icon className="icon" />}
        <span>{children}</span>
      </>
    )}
  </button>
);

const InputField = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon: Icon,
}) => (
  <div className="input-container">
    <label htmlFor={id} className="input-label">
      {label}
    </label>
    <div className="input-wrapper">
      {Icon && (
        <div className="input-icon">
          <Icon className="icon" />
        </div>
      )}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="input-field"
      />
    </div>
  </div>
);

const AuthForm = ({ title, children, footer, onSwitch, loading }) => (
  <div className="auth-form">
    <div className="form-header">
      <h2 className="form-title">{title}</h2>
    </div>
    <form onSubmit={(e) => e.preventDefault()} className="form">
      {children}
      {footer && (
        <div className="form-footer">
          <p className="footer-text">
            {footer.text}{" "}
            <button
              type="button"
              onClick={onSwitch}
              disabled={loading}
              className="footer-link"
            >
              {footer.linkText}
            </button>
          </p>
        </div>
      )}
    </form>
  </div>
);

// --- WELCOME SIDEBAR COMPONENT ---
const WelcomeSidebar = () => (
  <div className="welcome-sidebar">
    <div className="sidebar-content">
      <div className="logo-container">
        <Eye className="app-logo" />
        <h1 className="app-title">VISION RT</h1>
      </div>

      <div className="welcome-message-container">
        <h2 className="welcome-title">Welcome to VISION RT</h2>
      </div>
    </div>
  </div>
);

// --- VIEW COMPONENTS ---

const LoginComponent = ({
  setView,
  setUsernameForConfirmation,
  displayMessage,
  loading,
  setLoading,
  onAuthSuccess,
}) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = async () => {
    if (!username || !password) {
      displayMessage("Please enter username and password.", "error");
      return;
    }

    setLoading(true);
    displayMessage(null);

    try {
      const result = await authService.signIn(username, password);

      if (result.requiresConfirmation) {
        displayMessage(result.message, "info");
        setUsernameForConfirmation(username);
        setView("confirm");
      } else if (result.success) {
        displayMessage(result.message, "success");
        onAuthSuccess();
      }
    } catch (error) {
      console.error("Sign in error:", error);
      displayMessage(error.message, "error");

      if (error.name === "UserNotConfirmedException") {
        setUsernameForConfirmation(username);
        setView("confirm");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Sign In"
      footer={{ text: "Don't have an account?", linkText: "Sign Up" }}
      onSwitch={() => setView("signup")}
      loading={loading}
    >
      <InputField
        id="username"
        label="Username"
        type="text"
        value={username}
        onChange={setUsername}
        placeholder="Enter your username"
        icon={AtSign}
      />
      <InputField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="Enter your password"
        icon={Lock}
      />
      <Button onClick={handleSignIn} loading={loading} icon={LogIn}>
        Sign In
      </Button>
    </AuthForm>
  );
};

const SignupComponent = ({
  setView,
  setUsernameForConfirmation,
  displayMessage,
  loading,
  setLoading,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSignUp = async () => {
    if (!firstName || !lastName || !email || !password) {
      displayMessage("All fields are required.", "error");
      return;
    }

    const username =
      email.split("@")[0] || `${firstName}${lastName}`.toLowerCase();

    setLoading(true);
    displayMessage(null);

    try {
      const result = await authService.signUp(
        username,
        email,
        password,
        `${firstName} ${lastName}`
      );
      displayMessage(result.message, "success");
      setUsernameForConfirmation(username);
      setView("confirm");
    } catch (error) {
      console.error("Sign up error:", error);
      displayMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Create your Account"
      footer={{ text: "Already have an account?", linkText: "Sign In" }}
      onSwitch={() => setView("login")}
      loading={loading}
    >
      <div className="name-fields">
        <div className="name-field">
          <InputField
            id="firstName"
            label="First name"
            type="text"
            value={firstName}
            onChange={setFirstName}
            placeholder="First name"
          />
        </div>
        <div className="name-field">
          <InputField
            id="lastName"
            label="Last name"
            type="text"
            value={lastName}
            onChange={setLastName}
            placeholder="Last name"
          />
        </div>
      </div>
      <InputField
        id="email"
        label="Email address"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="Email address"
        icon={AtSign}
      />
      <InputField
        id="password"
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="Password"
        icon={Lock}
      />
      <div className="terms-container">
        <input type="checkbox" id="terms" className="terms-checkbox" />
        <label htmlFor="terms" className="terms-label">
          Accept Terms and Conditions
        </label>
      </div>
      <Button onClick={handleSignUp} loading={loading} icon={UserPlus}>
        Sign Up
      </Button>
    </AuthForm>
  );
};

const ConfirmSignupComponent = ({
  setView,
  usernameForConfirmation,
  displayMessage,
  loading,
  setLoading,
}) => {
  const [code, setCode] = useState("");
  const [username, setUsername] = useState(usernameForConfirmation || "");

  const handleConfirmation = async () => {
    if (!username || !code) {
      displayMessage("Username and verification code are required.", "error");
      return;
    }

    setLoading(true);
    displayMessage(null);

    try {
      const result = await authService.confirmSignUp(username, code);
      displayMessage(result.message, "success");
      setTimeout(() => setView("login"), 2000);
    } catch (error) {
      console.error("Confirmation error:", error);
      displayMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!username) {
      displayMessage("Please enter your username.", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await authService.resendConfirmationCode(username);
      displayMessage(result.message, "success");
    } catch (error) {
      console.error("Resend code error:", error);
      displayMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title="Confirm Account"
      footer={{ text: "Need to sign back in?", linkText: "Go to Login" }}
      onSwitch={() => setView("login")}
      loading={loading}
    >
      <p className="confirmation-instructions">
        A verification code has been sent to your email.
      </p>
      <InputField
        id="username"
        label="Username"
        type="text"
        value={username}
        onChange={setUsername}
        placeholder="Username"
        icon={AtSign}
      />
      <InputField
        id="code"
        label="Confirmation Code"
        type="text"
        value={code}
        onChange={setCode}
        placeholder="Enter verification code"
        icon={Key}
      />
      <Button onClick={handleConfirmation} loading={loading} icon={MailCheck}>
        Confirm Account
      </Button>
      <button
        type="button"
        className="resend-button"
        disabled={loading}
        onClick={handleResendCode}
      >
        Resend Code
      </button>
    </AuthForm>
  );
};

const AuthenticatedComponent = ({ user, displayMessage, onSignOut }) => {
  const handleSignOut = async () => {
    try {
      await authService.signOut();
      displayMessage("Successfully signed out.", "info");
      onSignOut();
    } catch (error) {
      console.error("Sign out error:", error);
      displayMessage("Error signing out. Please try again.", "error");
    }
  };

  return (
    <div className="authenticated-container">
      <Home className="welcome-icon" />
      <h2 className="welcome-title">Welcome to VISION RT!</h2>
      <p className="welcome-message">You are successfully authenticated.</p>
      {user && (
        <div className="user-info">
          <p className="user-info-title">User Info:</p>
          <p className="user-detail">
            <span className="user-label">Username:</span> {user.username}
          </p>
          <p className="user-detail">
            <span className="user-label">User ID:</span> {user.userId}
          </p>
        </div>
      )}
      <Button onClick={handleSignOut} icon={Lock} className="signout-button">
        Sign Out
      </Button>
    </div>
  );
};

// --- MAIN AUTHENTICATION COMPONENT ---

const Authentication = ({ onAuthSuccess }) => {
  const [view, setView] = useState("login");
  const [message, setMessage] = useState(null);
  const [messageType, setMessageType] = useState("info");
  const [usernameForConfirmation, setUsernameForConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const displayMessage = (msg, type = "info") => {
    setMessage(msg);
    setMessageType(type);
  };

  useEffect(() => {
    if (message && messageType !== "error") {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message, messageType]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const result = await authService.getCurrentUser();
      if (result.success && result.user) {
        setCurrentUser(result.user);
        setIsAuthenticated(true);
        setView("authenticated");
      }
    } catch (error) {
      console.log("No authenticated user");
    }
  };

  const handleAuthSuccess = async () => {
    await checkAuthStatus();
    if (onAuthSuccess) {
      onAuthSuccess();
    }
  };

  const handleSignOut = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
    setView("login");
  };

  let CurrentViewComponent;
  const componentProps = {
    setView,
    displayMessage,
    usernameForConfirmation,
    setUsernameForConfirmation,
    loading,
    setLoading,
  };

  switch (view) {
    case "signup":
      CurrentViewComponent = <SignupComponent {...componentProps} />;
      break;
    case "confirm":
      CurrentViewComponent = <ConfirmSignupComponent {...componentProps} />;
      break;
    case "authenticated":
      CurrentViewComponent = (
        <AuthenticatedComponent
          user={currentUser}
          displayMessage={displayMessage}
          onSignOut={handleSignOut}
        />
      );
      break;
    case "login":
    default:
      CurrentViewComponent = (
        <LoginComponent {...componentProps} onAuthSuccess={handleAuthSuccess} />
      );
      break;
  }

  const getMessageStyles = () => {
    switch (messageType) {
      case "success":
        return "message-success";
      case "error":
        return "message-error";
      case "info":
      default:
        return "message-info";
    }
  };

  return (
    <div className="authentication-container">
      <div className="auth-layout">
        <WelcomeSidebar />

        <div className="form-section">
          <div className="form-container">
            {message && (
              <div className={`message ${getMessageStyles()}`} role="alert">
                <p className="message-type">{messageType}!</p>
                <p className="message-text">{message}</p>
              </div>
            )}

            <div className="view-container">{CurrentViewComponent}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Authentication;
