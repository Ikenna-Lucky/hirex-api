export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface JwtPayload {
  sub: string;       // company id
  email: string;
  name: string;
  iat?: number;
  exp?: number;
}

export type ApplicationStage =
  | "applied"
  | "screening"
  | "shortlisted"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

export type JobStatus = "draft" | "active" | "closed" | "archived";

export type SubscriptionPlan = "starter" | "growth" | "scale";
