interface CognitoConfig {
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId: string;
  loginWith?: Partial<{ email: boolean; username: boolean; phone: boolean }>;
}

const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || "us-east-1_PVXEmostK",
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || "4o2h9exampleid37fmnmof0",
      identityPoolId: process.env.REACT_APP_IDENTITY_POOL_ID || "us-east-1:309d750c-387b-4ff1-9dad-468d30a525e0",
      loginWith: { email: true, username: true },
    } as CognitoConfig,
  },
};

export default awsConfig;
