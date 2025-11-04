import React, { useState, useEffect, ReactNode, CSSProperties } from "react";
import "../../../src/index.css";
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
  EyeOff,
  LucideIcon,
} from "lucide-react";
import ForgetPassword from "./ForgetPassword";
import authService from "../../services/authService";
import { User } from "../../types/";

// --- TYPE DEFINITIONS ---

type MessageType = "info" | "success" | "error";

type ViewType = "login" | "signup" | "confirm" | "authenticated" | "forgetPass";



// Error type guard
interface ErrorWithMessage {
  message: string;
  name?: string;
}

function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as Record<string, unknown>).message === "string"
  );
}

function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) return error.message;
  return String(error);
}

interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  loading?: boolean;
  icon?: LucideIcon;
  className?: string;
}

interface InputFieldProps {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  icon?: LucideIcon;
}

interface AuthFormProps {
  title: string;
  children: ReactNode;
  footer?: {
    text?: string;
    linkText: string;
  };
  onSwitch?: () => void;
  loading?: boolean;
  formFooterStyles?: CSSProperties;
}

interface BaseComponentProps {
  setView: (view: ViewType) => void;
  displayMessage: (msg: string | null | undefined, type?: MessageType) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

interface LoginComponentProps extends BaseComponentProps {
  setUsernameForConfirmation: (username: string) => void;
  onAuthSuccess: () => Promise<void>;
}

interface SignupComponentProps extends BaseComponentProps {
  setUsernameForConfirmation: (username: string) => void;
}

interface ConfirmSignupComponentProps extends BaseComponentProps {
  usernameForConfirmation: string;
}

interface AuthenticatedComponentProps {
  user: User | null;
  displayMessage: (msg: string | null, type?: MessageType) => void;
  onSignOut: () => void;
}

interface AuthenticationProps {
  onAuthSuccess?: () => void;
}

// --- REUSABLE COMPONENTS ---

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  loading = false,
  icon: Icon,
  className = "",
}) => (
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

export const InputField: React.FC<InputFieldProps> = ({
  id,
  label,
  type,
  value,
  onChange,
  placeholder,
  icon: Icon,
}) => {
  const isPassword = type === "password";
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const inputType = isPassword && showPassword ? "text" : type;

  return (
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
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="input-field"
        />
        {isPassword && (
          <button
            type="button"
            className="password-toggle"
            onClick={() => {
              setShowPassword(!showPassword);
            }}
          >
            {showPassword ? (
              <EyeOff className="icon" />
            ) : (
              <Eye className="icon" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export const AuthForm: React.FC<AuthFormProps> = ({
  title,
  children,
  footer,
  onSwitch,
  loading = false,
  formFooterStyles,
}) => (
  <div className="auth-form">
    <div className="form-header">
      <h2 className="form-title">{title}</h2>
    </div>
    <form onSubmit={(e) => e.preventDefault()} className="form">
      {children}
      {footer && (
        <div className="form-footer" style={formFooterStyles}>
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

const WelcomeSidebar: React.FC = () => (
  <div className="welcome-sidebar">
    <div className="sidebar-content">
      <div className="logo-container">
        <Eye className="app-logo" />
        <h1 className="app-title">VISION AI</h1>
      </div>

      <div className="welcome-message-container">
        <h2 className="welcome-title">Welcome to VISION AI</h2>
      </div>
    </div>
  </div>
);

// --- VIEW COMPONENTS ---

const LoginComponent: React.FC<LoginComponentProps> = ({
  setView,
  setUsernameForConfirmation,
  displayMessage,
  loading,
  setLoading,
  onAuthSuccess,
}) => {
  const [username, setUsername] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleSignIn = async (): Promise<void> => {
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
    } catch (error: unknown) {
      console.error("Sign in error:", error);
      const errorMsg = getErrorMessage(error);
      displayMessage(errorMsg, "error");

      if (
        isErrorWithMessage(error) &&
        error.name === "UserNotConfirmedException"
      ) {
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
      <div className="form-footer" style={{ marginBottom: "1em" }}>
        <button
          type="button"
          onClick={() => setView("forgetPass")}
          disabled={loading}
          className="footer-link"
        >
          Forget Password?
        </button>
      </div>
      <Button onClick={handleSignIn} loading={loading} icon={LogIn}>
        Sign In
      </Button>
    </AuthForm>
  );
};

const SignupComponent: React.FC<SignupComponentProps> = ({
  setView,
  setUsernameForConfirmation,
  displayMessage,
  loading,
  setLoading,
}) => {
  const [firstName, setFirstName] = useState<string>("");
  const [lastName, setLastName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");

  const handleSignUp = async (): Promise<void> => {
    if (!firstName || !lastName || !email || !password) {
      displayMessage("All fields are required.", "error");
      return;
    }

    const username =
      email.split("@")[0] || `${firstName}${lastName}`.toLowerCase();

    setLoading(true);
    displayMessage(null);

    try {
      const result = await authService.signUp(username, email, password);
      displayMessage(result.message, "success");
      setUsernameForConfirmation(username);
      setView("confirm");
    } catch (error: unknown) {
      console.error("Sign up error:", error);
      displayMessage(getErrorMessage(error), "error");
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

const ConfirmSignupComponent: React.FC<ConfirmSignupComponentProps> = ({
  setView,
  usernameForConfirmation,
  displayMessage,
  loading,
  setLoading,
}) => {
  const [code, setCode] = useState<string>("");
  const [username, setUsername] = useState<string>(
    usernameForConfirmation || ""
  );

  const handleConfirmation = async (): Promise<void> => {
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
    } catch (error: unknown) {
      console.error("Confirmation error:", error);
      displayMessage(getErrorMessage(error), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async (): Promise<void> => {
    if (!username) {
      displayMessage("Please enter your username.", "error");
      return;
    }

    setLoading(true);
    try {
      const result = await authService.resendConfirmationCode(username);
      displayMessage(result.message, "success");
    } catch (error: unknown) {
      console.error("Resend code error:", error);
      displayMessage(getErrorMessage(error), "error");
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

const AuthenticatedComponent: React.FC<AuthenticatedComponentProps> = ({
  user,
  displayMessage,
  onSignOut,
}) => {
  const handleSignOut = async (): Promise<void> => {
    try {
      await authService.signOut();
      displayMessage("Successfully signed out.", "info");
      onSignOut();
    } catch (error: unknown) {
      console.error("Sign out error:", error);
      displayMessage("Error signing out. Please try again.", "error");
    }
  };

  return (
    <div className="authenticated-container">
      <Home className="welcome-icon" />
      <h2 className="welcome-title">Welcome to VISION AI!</h2>
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

const Authentication: React.FC<AuthenticationProps> = ({ onAuthSuccess }) => {
  const [view, setView] = useState<ViewType>("login");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<MessageType>("info");
  const [usernameForConfirmation, setUsernameForConfirmation] =
    useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const displayMessage = (
    msg: string | null | undefined,
    type: MessageType = "info"
  ): void => {
    setMessage(msg || null);
    setMessageType(type);
  };

  useEffect(() => {
    if (message && messageType !== "error") {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [message, messageType]);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async (): Promise<void> => {
    try {
      const result = await authService.getCurrentUser();
      if (result.success && result.user) {
        setCurrentUser(result.user);
        setView("authenticated");
      }
    } catch (error) {
      console.log("No authenticated user");
    }
  };

  const handleAuthSuccess = async (): Promise<void> => {
    await checkAuthStatus();
    if (onAuthSuccess) {
      onAuthSuccess();
    }
  };

  const handleSignOut = (): void => {
    setCurrentUser(null);
    setView("login");
  };

  let CurrentViewComponent: ReactNode;
  const componentProps: BaseComponentProps = {
    setView,
    displayMessage,
    loading,
    setLoading,
  };

  switch (view) {
    case "signup":
      CurrentViewComponent = (
        <SignupComponent
          {...componentProps}
          setUsernameForConfirmation={setUsernameForConfirmation}
        />
      );
      break;
    case "confirm":
      CurrentViewComponent = (
        <ConfirmSignupComponent
          {...componentProps}
          usernameForConfirmation={usernameForConfirmation}
        />
      );
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
    case "forgetPass":
      CurrentViewComponent = (
        <ForgetPassword
          displayMessage={displayMessage}
          setLoading={setLoading}
          setView={setView}
          loading={loading}
        />
      );
      break;
    case "login":
    default:
      CurrentViewComponent = (
        <LoginComponent
          {...componentProps}
          setUsernameForConfirmation={setUsernameForConfirmation}
          onAuthSuccess={handleAuthSuccess}
        />
      );
      break;
  }

  const getMessageStyles = (): string => {
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
