
import { 
  signUp, 
  signIn, 
  signOut, 
  confirmSignUp, 
  resendSignUpCode,
  getCurrentUser,
  fetchAuthSession
} from 'aws-amplify/auth';
 
/**
* Sign up a new user
*/
export async function signUpUser(username, email, password) {
  try {
    const { isSignUpComplete, userId, nextStep } = await signUp({
      username,
      password,
      options: {
        userAttributes: {
          email
        },
        autoSignIn: true
      }
    });
    return {
      success: true,
      isSignUpComplete,
      userId,
      nextStep,
      message: 'Sign up successful! Check your email for verification code.'
    };
  } catch (error) {
    console.error('Sign up error:', error);
    throw handleAuthError(error);
  }
}
 
/**
* Confirm sign up with verification code
*/
export async function confirmSignUpUser(username, confirmationCode) {
  try {
    const { isSignUpComplete, nextStep } = await confirmSignUp({
      username,
      confirmationCode
    });
    return {
      success: true,
      isSignUpComplete,
      nextStep,
      message: 'Account confirmed successfully! You can now sign in.'
    };
  } catch (error) {
    console.error('Confirm sign up error:', error);
    throw handleAuthError(error);
  }
}
 
/**
* Resend confirmation code
*/
export async function resendConfirmationCode(username) {
  try {
    await resendSignUpCode({ username });
    return {
      success: true,
      message: 'Verification code resent successfully!'
    };
  } catch (error) {
    console.error('Resend code error:', error);
    throw handleAuthError(error);
  }
}
 
/**
* Sign in a user
*/
export async function signInUser(username, password) {
  try {
    const { isSignedIn, nextStep } = await signIn({
      username,
      password
    });
    if (nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
      return {
        success: false,
        requiresConfirmation: true,
        message: 'Please confirm your account first. Check your email for the verification code.'
      };
    }
    return {
      success: true,
      isSignedIn,
      nextStep,
      message: 'Sign in successful!'
    };
  } catch (error) {
    console.error('Sign in error:', error);
    throw handleAuthError(error);
  }
}
 
/**
* Sign out the current user
*/
export async function signOutUser() {
  try {
    await signOut();
    return {
      success: true,
      message: 'Signed out successfully!'
    };
  } catch (error) {
    console.error('Sign out error:', error);
    throw handleAuthError(error);
  }
}
 
/**
* Get the current authenticated user
*/
export async function getCurrentAuthUser() {
  try {
    const user = await getCurrentUser();
    return {
      success: true,
      user
    };
  } catch (error) {
    console.error('Get current user error:', error);
    return {
      success: false,
      user: null
    };
  }
}
 
/**
* Get the current auth session (tokens)
*/
export async function getAuthSession() {
  try {
    const session = await fetchAuthSession();
    return {
      success: true,
      session
    };
  } catch (error) {
    console.error('Get session error:', error);
    return {
      success: false,
      session: null
    };
  }
}
 
/**
* Handle and format authentication errors
*/
function handleAuthError(error) {
  const errorMessages = {
    'UsernameExistsException': 'An account with this username already exists.',
    'InvalidParameterException': 'Invalid parameters provided. Please check your input.',
    'InvalidPasswordException': 'Password does not meet requirements. Must be at least 8 characters with uppercase, lowercase, number, and symbol.',
    'CodeMismatchException': 'Invalid verification code. Please try again.',
    'ExpiredCodeException': 'Verification code has expired. Please request a new one.',
    'NotAuthorizedException': 'Incorrect username or password.',
    'UserNotConfirmedException': 'Please verify your account. Check your email for the verification code.',
    'UserNotFoundException': 'User not found. Please check your username.',
    'TooManyRequestsException': 'Too many attempts. Please try again later.',
    'LimitExceededException': 'Attempt limit exceeded. Please try again later.'
  };
 
  const errorMessage = errorMessages[error.name] || error.message || 'An authentication error occurred.';
  const formattedError = new Error(errorMessage);
  formattedError.name = error.name;
  formattedError.originalError = error;
  return formattedError;
}
 
// Create service object for backward compatibility
const authService = {
  signUp: signUpUser,
  confirmSignUp: confirmSignUpUser,
  resendConfirmationCode: resendConfirmationCode,
  signIn: signInUser,
  signOut: signOutUser,
  getCurrentUser: getCurrentAuthUser,
  getSession: getAuthSession
};
 
export default authService;