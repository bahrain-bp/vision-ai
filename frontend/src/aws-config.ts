interface CognitoConfig {
  userPoolId: string;
  userPoolClientId: string;
  loginWith?: Partial<{ email: boolean; username: boolean; phone: boolean }>;
}

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || "",
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || "",
      loginWith: { email: true, username: true },
    } as CognitoConfig,
  },
};

export default awsConfig;
