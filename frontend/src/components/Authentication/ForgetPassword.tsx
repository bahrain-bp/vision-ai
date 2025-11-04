import React, { useState } from "react";
import { Key, Mail, Lock, ArrowLeft } from "lucide-react";
import { AuthForm } from "./Authentication";
import authService from "../../services/authService";
import { Button, InputField } from "../common/common";

// --- TYPE DEFINITIONS ---

type MessageType = "info" | "success" | "error";
type ViewType = "login" | "signup" | "confirm" | "authenticated" | "forgetPass";
type ForgetPasswordStep = "request" | "reset";

interface ForgetPasswordProps {
  displayMessage: (msg: string | null | undefined, type?: MessageType) => void;
  setLoading: (loading: boolean) => void;
  setView: (view: ViewType) => void;
  loading: boolean;
}

// Error type guard
interface ErrorWithMessage {
  message: string;
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

// --- FORGET PASSWORD COMPONENT ---

const ForgetPassword: React.FC<ForgetPasswordProps> = ({
  displayMessage,
  setLoading,
  setView,
  loading,
}) => {
  const [step, setStep] = useState<ForgetPasswordStep>("request");
  const [username, setUsername] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [newPassword, setNewPassword] = useState<string>("");

  const handleRequestCode = async (): Promise<void> => {
    if (!username) {
      displayMessage("Please enter your username.", "error");
      return;
    }

    setLoading(true);
    displayMessage(null);

    try {
      const result = await authService.forgotPassword(username);
      displayMessage(result.message, "success");
      setStep("reset");
    } catch (error: unknown) {
      displayMessage(
        getErrorMessage(error) || "Failed to request code.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (): Promise<void> => {
    if (!username || !code || !newPassword) {
      displayMessage("All fields are required.", "error");
      return;
    }

    setLoading(true);
    displayMessage(null);

    try {
      const result = await authService.forgotPasswordSubmit(
        username,
        code,
        newPassword
      );
      displayMessage(result.message, "success");
      setTimeout(() => setView("login"), 2000);
    } catch (error: unknown) {
      displayMessage(
        getErrorMessage(error) || "Failed to reset password.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  if (step === "request") {
    return (
      <AuthForm
        title="Reset Password"
        footer={{ text: "Remember your password?", linkText: "Back to Login" }}
        onSwitch={() => setView("login")}
        loading={loading}
      >
        <p className="confirmation-instructions">
          Enter your username to receive a password reset code.
        </p>
        <InputField
          id="username"
          label="Username"
          type="text"
          value={username}
          onChange={setUsername}
          placeholder="Enter your username"
          icon={Mail}
        />
        <Button onClick={handleRequestCode} loading={loading} icon={Key}>
          Request Reset Code
        </Button>
      </AuthForm>
    );
  }

  return (
    <AuthForm
      title="Reset Password"
      footer={{ text: "Remember your password?", linkText: "Back to Login" }}
      onSwitch={() => setView("login")}
      loading={loading}
    >
      <p className="confirmation-instructions">
        Enter the verification code sent to your email and your new password.
      </p>
      <InputField
        id="username"
        label="Username"
        type="text"
        value={username}
        onChange={setUsername}
        placeholder="Username"
        icon={Mail}
      />
      <InputField
        id="code"
        label="Verification Code"
        type="text"
        value={code}
        onChange={setCode}
        placeholder="Enter verification code"
        icon={Key}
      />
      <InputField
        id="newPassword"
        label="New Password"
        type="password"
        value={newPassword}
        onChange={setNewPassword}
        placeholder="Enter new password"
        icon={Lock}
      />
      <Button onClick={handleResetPassword} loading={loading} icon={Lock}>
        Reset Password
      </Button>
      <button
        type="button"
        className="resend-button"
        disabled={loading}
        onClick={() => setStep("request")}
      >
        <ArrowLeft className="icon" style={{ width: "16px", height: "16px" }} />
        Back to Request Code
      </button>
    </AuthForm>
  );
};

export default ForgetPassword;
