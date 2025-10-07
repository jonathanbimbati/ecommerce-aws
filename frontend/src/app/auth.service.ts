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
      // fallback to local stub (for dev when backend isn't available)
      console.warn('Backend login failed, falling back to local stub', err);
      if (username && password) {
        const token = btoa(`${username}:${password}`);
        localStorage.setItem(this.tokenKey, token);
        return true;
      }
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
