import {
  signUp,
  signIn,
  signOut,
  confirmSignUp,
  resendSignUpCode,
  getCurrentUser,
  fetchAuthSession,
  resetPassword,
  confirmResetPassword,
} from "aws-amplify/auth";

interface AuthResult {
  success: boolean;
  message?: string;
  isSignUpComplete?: boolean;
  isSignedIn?: boolean;
  userId?: string;
  nextStep?: any;
  user?: any;
  session?: any;
  requiresConfirmation?: boolean;
}

interface ErrorMap {
  [key: string]: string;
}

/**
 * Sign up a new user
 */
export async function signUpUser(
  username: string,
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const { isSignUpComplete, userId, nextStep } = await signUp({
      username,
      password,
      options: {
        userAttributes: { email },
        autoSignIn: true,
      },
    });
    return {
      success: true,
      isSignUpComplete,
      userId,
      nextStep,
      message: "Sign up successful! Check your email for verification code.",
    };
  } catch (error: any) {
    console.error("Sign up error:", error);
    throw handleAuthError(error);
  }
}

/**
 * Confirm sign up with verification code
 */
export async function confirmSignUpUser(
  username: string,
  confirmationCode: string
): Promise<AuthResult> {
  try {
    const { isSignUpComplete, nextStep } = await confirmSignUp({
      username,
      confirmationCode,
    });
    return {
      success: true,
      isSignUpComplete,
      nextStep,
      message: "Account confirmed successfully! You can now sign in.",
    };
  } catch (error: any) {
    console.error("Confirm sign up error:", error);
    throw handleAuthError(error);
  }
}

/**
 * Resend confirmation code
 */
export async function resendConfirmationCode(
  username: string
): Promise<AuthResult> {
  try {
    await resendSignUpCode({ username });
    return {
      success: true,
      message: "Verification code resent successfully!",
    };
  } catch (error: any) {
    console.error("Resend code error:", error);
    throw handleAuthError(error);
  }
}

/**
 * Sign in a user
 */
export async function signInUser(
  username: string,
  password: string
): Promise<AuthResult> {
  try {
    const { isSignedIn, nextStep } = await signIn({ username, password });

    if (nextStep?.signInStep === "CONFIRM_SIGN_UP") {
      return {
        success: false,
        requiresConfirmation: true,
        message:
          "Please confirm your account first. Check your email for the verification code.",
      };
    }

    return {
      success: true,
      isSignedIn,
      nextStep,
      message: "Sign in successful!",
    };
  } catch (error: any) {
    console.error("Sign in error:", error);
    throw handleAuthError(error);
  }
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<AuthResult> {
  try {
    await signOut();
    return {
      success: true,
      message: "Signed out successfully!",
    };
  } catch (error: any) {
    console.error("Sign out error:", error);
    throw handleAuthError(error);
  }
}

/**
 * Get the current authenticated user
 */
export async function getCurrentAuthUser(): Promise<AuthResult> {
  try {
    const user = await getCurrentUser();
    return {
      success: true,
      user,
    };
  } catch (error: any) {
    console.error("Get current user error:", error);
    return {
      success: false,
      user: null,
    };
  }
}

/**
 * Get the current auth session (tokens)
 */
export async function getAuthSession(): Promise<AuthResult> {
  try {
    const session = await fetchAuthSession();
    return {
      success: true,
      session,
    };
  } catch (error: any) {
    console.error("Get session error:", error);
    return {
      success: false,
      session: null,
    };
  }
}

/**
 * Forgot password
 */
export async function forgotPasswordUser(
  username: string
): Promise<AuthResult> {
  try {
    const output = await resetPassword({ username });
    return {
      success: true,
      nextStep: output.nextStep,
      message: "Verification code sent to your email.",
    };
  } catch (error: any) {
    console.error("Forgot password error:", error);
    throw handleAuthError(error);
  }
}

/**
 * Complete forgot password flow
 */
export async function forgotPasswordSubmitUser(
  username: string,
  confirmationCode: string,
  newPassword: string
): Promise<AuthResult> {
  try {
    await confirmResetPassword({
      username,
      confirmationCode,
      newPassword,
    });
    return {
      success: true,
      message: "Password reset successful! Redirecting to login...",
    };
  } catch (error: any) {
    console.error("Reset password error:", error);
    throw handleAuthError(error);
  }
}

/**
 * Handle and format authentication errors
 */
function handleAuthError(error: any): Error {
  const errorMessages: ErrorMap = {
    UsernameExistsException: "An account with this username already exists.",
    InvalidParameterException:
      "Invalid parameters provided. Please check your input.",
    InvalidPasswordException:
      "Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, number, and symbol.",
    CodeMismatchException: "Invalid verification code. Please try again.",
    ExpiredCodeException:
      "Verification code has expired. Please request a new one.",
    NotAuthorizedException: "Incorrect username or password.",
    UserNotConfirmedException:
      "Please verify your account. Check your email for the verification code.",
    UserNotFoundException: "User not found. Please check your username.",
    TooManyRequestsException: "Too many attempts. Please try again later.",
    LimitExceededException: "Attempt limit exceeded. Please try again later.",
  };

  const errorMessage =
    errorMessages[error.name] ||
    error.message ||
    "An authentication error occurred.";

  const formattedError = new Error(errorMessage);
  (formattedError as any).name = error.name;
  (formattedError as any).originalError = error;
  return formattedError;
}

const authService = {
  signUp: signUpUser,
  confirmSignUp: confirmSignUpUser,
  resendConfirmationCode,
  signIn: signInUser,
  signOut: signOutUser,
  getCurrentUser: getCurrentAuthUser,
  getSession: getAuthSession,
  forgotPassword: forgotPasswordUser,
  forgotPasswordSubmit: forgotPasswordSubmitUser,
};

export default authService;
