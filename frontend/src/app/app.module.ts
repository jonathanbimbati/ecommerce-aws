import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { AppComponent } from './app.component';
import { ProductsComponent } from './products/products.component';

@NgModule({
  imports: [BrowserModule, HttpClientModule, FormsModule, AppComponent, ProductsComponent],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
