import { useState } from "react";
import { AuthForm, InputField, Button } from "./Authentication";
import { AtSign, Key, Lock, User, Eye, EyeOff } from "lucide-react";
import authService from "../../services/authService";

const ForgotPassword = ({ setView, displayMessage, loading, setLoading }) => {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState(1);

  const handleRequestCode = async () => {
    if (!email) {
      displayMessage("Please enter your email.", "error");
      return;
    }

    displayMessage(null);

    try {
      const result = await authService.forgotPassword(email);
      if (result.success) {
        displayMessage(result.message, "success");
        setStep(2);
      } else {
        displayMessage(result.message, "error");
        setStep(1);
      }
    } catch (error) {
      console.error("Forgot password error:", error);
      displayMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code) {
      displayMessage("Please enter the code.", "error");
      return;
    }
    if (!newPassword || !confirmPassword) {
      displayMessage("Please enter both password fields.", "error");
      return;
    }
    if (newPassword !== confirmPassword) {
      displayMessage(
        "Passwords do not match. Please make sure both fields are identical.",
        "error"
      );
      return;
    }


    setLoading(true);
    displayMessage(null);

    try {
      const result = await authService.forgotPasswordSubmitUser(
        email,
        code,
        newPassword
      );
      displayMessage(result.message, "success");
      setTimeout(() => setView("login"), 2000);
    } catch (error) {
      console.error("Reset password error:", error);
      displayMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthForm
      title={step === 1 ? "Forgot Password" : "Reset Password"}
      footer={{ text: "Remember your password?", linkText: "Sign In" }}
      onSwitch={() => setView("login")}
      loading={loading}
    >
      {step === 1 ? (
        <>
          <p className="confirmation-instructions">
            Please enter your email address or username to receive your
            verification code.
          </p>
          <InputField
            id="email/user"
            label="Email Address/ Username"
            type="text"
            value={email}
            onChange={setEmail}
            placeholder="Your email / username"
            icon={User}
          />
          <Button onClick={handleRequestCode} loading={loading} icon={Key}>
            Send Code
          </Button>
        </>
      ) : (
        <>
          <p className="confirmation-instructions">
            Enter the verification code sent to <strong>{email}</strong> and
            your new password.
          </p>
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
            type={"password"}
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Enter new password (min 8 chars)"
            icon={Lock}
          />
          <InputField
            id="confirmPassword"
            label="Confirm Password"
            type={"password"}
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Enter new password (min 8 chars)"
            icon={Lock}
          />
          <Button onClick={handleResetPassword} loading={loading} icon={Lock}>
            Reset Password
          </Button>
          <button
            type="button"
            className="resend-button"
            disabled={loading}
            onClick={handleRequestCode}
          >
            Resend Code
          </button>
        </>
      )}
    </AuthForm>
  );
};

export default ForgotPassword;
