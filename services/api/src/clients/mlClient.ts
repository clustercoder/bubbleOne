import axios, { AxiosInstance } from "axios";

import { MetadataEvent, MLOutcome } from "../types";

export class MLClient {
  private readonly http: AxiosInstance;

  constructor(baseUrl: string) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: 20000,
    });
  }

  async health(): Promise<unknown> {
    const resp = await this.http.get("/health");
    return resp.data;
  }

  async processContact(payload: {
    contact_hash: string;
    alias: string;
    events: MetadataEvent[];
    previous_score: number;
    interaction_multiplier?: number;
    lambda_decay_override?: number;
    recent_event_count_7d?: number;
    prior_event_count_7d?: number;
    temporal_training_enabled?: boolean;
  }): Promise<MLOutcome> {
    const resp = await this.http.post<MLOutcome>("/v1/process-contact", payload);
    return resp.data;
  }
}
