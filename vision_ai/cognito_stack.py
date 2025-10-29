import aws_cdk as cdk
from constructs import Construct
from aws_cdk import (
    aws_cognito as cognito,
    CfnOutput,
    RemovalPolicy
)
 
 
class CognitoStack(cdk.Stack):
    """
    Defines the AWS Cognito User Pool and App Client for the Vision AI application.
    Exports the User Pool ID and Client ID needed for the React frontend configuration.
    """
    def __init__(
        self, 
        scope: Construct, 
        construct_id: str, 
        app_name: str,
        **kwargs
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)
        # 1. Create the Cognito User Pool
        user_pool = cognito.UserPool(
            self,
            f"{app_name}UserPool",
            user_pool_name=f"{app_name}-users",
            self_sign_up_enabled=True,
            sign_in_aliases=cognito.SignInAliases(
                username=True, 
                email=True
            ),
            auto_verify=cognito.AutoVerifiedAttrs(email=True),
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(
                    required=True, 
                    mutable=True
                )
            ),
            password_policy=cognito.PasswordPolicy(
                min_length=8,
                require_lowercase=True,
                require_uppercase=True,
                require_digits=True,
                require_symbols=True
            ),
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY,
            removal_policy=RemovalPolicy.DESTROY
        )
        # 2. Add an App Client for the React Frontend
        user_pool_client = user_pool.add_client(
            f"{app_name}AppClient",
            user_pool_client_name=f"{app_name}-react-client",
            auth_flows=cognito.AuthFlow(
                user_srp=True,
                user_password=True,
                admin_user_password=False
            ),
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(
                    authorization_code_grant=True,
                    implicit_code_grant=True
                ),
                scopes=[
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE
                ],
                callback_urls=[
                    "http://localhost:3000",
                    "http://localhost:3000/callback"
                ],
                logout_urls=[
                    "http://localhost:3000",
                    "http://localhost:3000/logout"
                ]
            ),
            prevent_user_existence_errors=True,
            generate_secret=False  # Important for public clients like React
        )
        # 3. Add a domain for hosted UI (optional but recommended)
        user_pool_domain = user_pool.add_domain(
            f"{app_name}Domain",
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix=f"{app_name}-{self.account}"
            )
        )
        # 4. Store references for other stacks
        self.user_pool = user_pool
        self.user_pool_client = user_pool_client
        # 5. Export necessary values for the React frontend
        CfnOutput(
            self,
            "UserPoolId",
            value=user_pool.user_pool_id,
            description="The ID of the Cognito User Pool",
            export_name=f"{app_name}UserPoolId"
        )
        CfnOutput(
            self,
            "UserPoolClientId",
            value=user_pool_client.user_pool_client_id,
            description="The ID of the User Pool App Client",
            export_name=f"{app_name}UserPoolClientId"
        )
        CfnOutput(
            self,
            "AwsRegion",
            value=self.region,
            description="The AWS Region where Cognito is deployed",
            export_name=f"{app_name}Region"
        )
        CfnOutput(
            self,
            "CognitoDomain",
            value=user_pool_domain.domain_name,
            description="The Cognito Domain for hosted UI",
            export_name=f"{app_name}CognitoDomain"
        )
        CfnOutput(
            self,
            "HostedUIUrl",
            value=f"https://{user_pool_domain.domain_name}.auth.{self.region}.amazoncognito.com",
            description="The Hosted UI URL",
            export_name=f"{app_name}HostedUIUrl"
        )