import React from "react";
import { Amplify } from "aws-amplify";
import awsConfig from "./aws-config";
import RewriteTest from "./components/Processing/RewriteTest";

Amplify.configure(awsConfig);

const App: React.FC = () => {

  return (
    <div className="App">
      <RewriteTest />
    </div>
  );
};

export default App;
