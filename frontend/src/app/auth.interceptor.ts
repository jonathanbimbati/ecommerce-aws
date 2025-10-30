import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private auth: AuthService, private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const token = this.auth.getToken();
    const withAuth = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
    return next.handle(withAuth).pipe(
      catchError((err: any) => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          // Avoid intercepting the login/register calls themselves
          const url = (req.url || '').toLowerCase();
          const isAuthCall = url.includes('/api/auth/login') || url.includes('/api/auth/register');
          if (!isAuthCall) {
            // Clear token and redirect to login
            this.auth.logout();
            try { this.router.navigate(['/login']); } catch {}
          }
        }
        return throwError(() => err);
      })
    );
  }
}
