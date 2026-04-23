import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment.development';
import {
  User,
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  MeResponse,
} from '../../../core/models/auth.models';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly TOKEN_KEY = 'auth_token';

  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {
    // Check if token exists on service init
    const token = this.getToken();
    if (token) {
      this.loadCurrentUser();
    }
  }

  /**
   * Register new user
   */
  register(data: RegisterRequest): Observable<MeResponse> {
    return this.http.post<MeResponse>(`${this.API_URL}/register`, data).pipe(
      tap((response) => {
        console.log('Registration successful:', response);
      }),
    );
  }

  /**
   * Login user
   */
  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, data).pipe(
      tap((response) => {
        this.setToken(response.token);
        this.loadCurrentUser();
      }),
    );
  }

  /**
   * Get current user data
   */
  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.API_URL}/me`).pipe(
      tap((user) => {
        this.currentUserSubject.next(user);
      }),
    );
  }

  /**
   * Load current user from /me endpoint
   */
  private loadCurrentUser(): void {
    this.me().subscribe({
      next: (user) => {
        console.log('User loaded:', user);
      },
      error: (err) => {
        console.error('Failed to load user:', err);
        this.logout();
      },
    });
  }

  /**
   * Logout user
   */
  logout(): void {
    this.removeToken();
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Save token to localStorage
   */
  private setToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
  }

  /**
   * Remove token from localStorage
   */
  private removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
  }

  /**
   * Get current user value (synchronous)
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }
}
