export interface Env {
  DB: D1Database;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  FRONTEND_URL: string;
}

export type AppVariables = {
  userId: string;
  email: string;
};
