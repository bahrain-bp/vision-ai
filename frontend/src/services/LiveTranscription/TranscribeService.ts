import {
  TranscribeStreamingClient,
} from "@aws-sdk/client-transcribe-streaming";
import { getUserCredentials } from "../authService";

 class TranscribeService {
   private client: TranscribeStreamingClient | null = null;
   private static instance: TranscribeService;
   private async initializeClient() {
     const session = await getUserCredentials();

     if (!session.credentials) {
       throw new Error("No credentials available. User must be signed in.");
     }

     this.client = new TranscribeStreamingClient({
       region: process.env.REACT_APP_AWS_REGION,
       credentials: session.credentials,
     });
   }

    async getClient(){
      if(this.client=== null){
        await this.initializeClient();
      }
      return this.client;
   }

   static getInstance():TranscribeService{
      if(!TranscribeService.instance){
        TranscribeService.instance = new TranscribeService();
      }
      return TranscribeService.instance;
   };
 }
export default TranscribeService.getInstance();
