import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface AuthResponse { token: string }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'ecom_token';

  constructor(private http: HttpClient) {}

  async login(username: string, password: string) {
    // Try backend login
    try {
      const obs = this.http.post<AuthResponse>('/api/auth/login', { username, password });
      const res = await firstValueFrom(obs);
      if (res && res.token) {
        localStorage.setItem(this.tokenKey, res.token);
        return true;
      }
    } catch (err) {
      // Fallback to a local stub ONLY in local dev (localhost) or when explicitly enabled.
      // Never use stub tokens in deployed environments — they will fail authenticated API calls.
      const status = err && (err as any).status;
      const allowEnv = (window as any)?.__env?.ALLOW_LOGIN_FALLBACK === true;
      const isLocalhost = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
      const allowFallback = (status === 0) && (allowEnv || isLocalhost);
      if (allowFallback) {
        console.warn('Backend unreachable in dev, falling back to local stub', err);
        if (username && password) {
          const token = btoa(`${username}:${password}`);
          localStorage.setItem(this.tokenKey, token);
          return true;
        }
      }
      // backend returned a real response (e.g. 401) or we are not in dev — do not fallback
      console.warn('Backend login failed or fallback disabled. Status:', status);
      return false;
    }
    return false;
  }

  async register(username: string, password: string, name?: string) {
    try {
      const obs = this.http.post<AuthResponse>('/api/auth/register', { username, password, name });
      const res = await firstValueFrom(obs);
      if (res && res.token) {
        localStorage.setItem(this.tokenKey, res.token);
        return true;
      }
    } catch (err) {
      console.error('Registration failed', err);
    }
    return false;
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }
}
