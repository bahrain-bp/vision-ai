import axios from "axios";
import { AxiosError } from "../types/caseManagement";
const API_BASE_URL = process.env.REACT_APP_API_ENDPOINT;

export interface Case {
  caseId: string;
  caseTitle: string;
  caseDescription: string;
  createdAt: string;
  createdBy: string;
  status: "active" | "inactive";
  totalSessions: number;
  lastUpdated: string;
}

export interface Session {
  sessionId: string;
  caseId: string;
  sessionDate: string;
  investigator: string;
  personType: "witness" | "accused" | "victim";
  personName?: string;
  cprNumber?: string;
  status: "pending" | "in-progress" | "completed";
  duration: string;
  createdAt: string;
}

export interface CaseWithSessions extends Case {
  sessions: Session[];
}

class CaseService {
  private axiosInstance;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error("API Error:", {
          message: error.message,
          status: error.response?.status,
          url: error.config?.url,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Get all cases from API
   */
  async getAllCases(): Promise<Case[]> {
    try {
      const response = await this.axiosInstance.get<{ cases: Case[] }>(
        "/cases"
      );
      return response.data.cases || [];
    } catch (error) {
      console.error("Error fetching cases:", error);
      throw new Error("Failed to fetch cases");
    }
  }

  /**
   * Get a specific case with all its sessions
   */
  async getCaseById(caseId: string): Promise<CaseWithSessions> {
    try {
      const response = await this.axiosInstance.get<CaseWithSessions>(
        `/cases/${caseId}`
      );
      return response.data;
    } catch (error) {
      console.error(`Error fetching case ${caseId}:`, error);
      throw new Error(`Failed to fetch case ${caseId}`);
    }
  }

  /**
   * Create a new case

   */
  async createCase(
    caseTitle: string,
    caseDescription: string,
    createdBy: string
  ): Promise<Case> {
    if (!caseTitle.trim()) {
      throw new Error("Case title is required");
    }

    if (!createdBy.trim()) {
      throw new Error("Creator name is required");
    }

    try {
      // Send only the data needed
      const requestBody = {
        caseTitle: caseTitle.trim(),
        caseDescription: caseDescription.trim(),
        createdBy: createdBy.trim(),
      };

      const response = await this.axiosInstance.post<Case>(
        "/cases",
        requestBody
      );

      // Return the complete case object from backend
      return response.data;
    } catch (error) {
      console.error("Error creating case:", error);
      throw new Error("Failed to create case");
    }
  }

  /**
   * Create a new session within a case

   */
  async createSession(caseId: string, investigator: string): Promise<Session> {
    if (!caseId.trim()) {
      throw new Error("Case ID is required");
    }

    if (!investigator.trim()) {
      throw new Error("Investigator name is required");
    }

    try {
      const requestBody = {
        caseId,
        investigator: investigator.trim(),
      };

      const response = await this.axiosInstance.post<Session>(
        `/cases/${caseId}/sessions`,
        requestBody
      );

      return response.data;
    } catch (error: unknown) {
      console.error("Error creating session:", error);
      throw new Error("Failed to create session");
    }
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    caseId: string,
    sessionId: string,
    status: Session["status"]
  ): Promise<void> {
    try {
      await this.axiosInstance.patch(`/cases/${caseId}/sessions/${sessionId}`, {
        status,
      });
      console.log(`Updated session ${sessionId} status to ${status}`);
    } catch (error) {
      console.error("Error updating session status:", error);
      throw new Error("Failed to update session status");
    }
  }

  /**
   * Update case status
   */
  async updateCaseStatus(
    caseId: string,
    status: "active" | "inactive"
  ): Promise<Case> {
    try {
      const response = await this.axiosInstance.patch<Case>(
        `/cases/${caseId}`,
        {
          status,
        }
      );
      console.log(`Updated case ${caseId} status to ${status}`);
      return response.data;
    } catch (error) {
      console.error("Error updating case status:", error);
      throw new Error("Failed to update case status");
    }
  }
}

const caseService = new CaseService();
export default caseService;