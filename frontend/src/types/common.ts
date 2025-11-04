export interface User {
  username: string;
  userId: string;
  [key: string]: any;
  email: string;
}
export type RecordingStatus = "on" | "off" | "paused";