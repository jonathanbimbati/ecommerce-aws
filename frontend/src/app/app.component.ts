import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { ProductsComponent } from './products/products.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [ProductsComponent],
  templateUrl: './app.component.html'
})
export class AppComponent { }
