// Auth Models
export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface LoginResponse {
  token: string;
}

export interface MeResponse {
  id: number;
  email: string;
  name: string | null;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}