import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { importProvidersFrom, Provider } from '@angular/core';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { AppComponent, appRoutes } from './app/app.component';
import { AuthInterceptor } from './app/auth.interceptor';

const interceptorProvider: Provider = {
  provide: HTTP_INTERCEPTORS,
  useClass: AuthInterceptor,
  multi: true
};

const providers = [
  provideHttpClient(),
  importProvidersFrom(HttpClientModule, FormsModule),
  provideRouter(appRoutes),
  interceptorProvider
];

bootstrapApplication(AppComponent, { providers }).catch((err: any) => console.error(err));
