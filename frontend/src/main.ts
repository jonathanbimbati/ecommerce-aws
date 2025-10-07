import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { importProvidersFrom } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app/app.component';
import { Routes } from '@angular/router';

// routes are defined in AppComponent but we still need to provide router at bootstrap
const appRoutes: Routes = [];

const providers = [
  provideHttpClient(),
  importProvidersFrom(HttpClientModule, FormsModule),
  provideRouter(appRoutes)
];

bootstrapApplication(AppComponent, { providers }).catch((err: any) => console.error(err));
