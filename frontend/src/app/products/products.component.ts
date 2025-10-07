import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html'
})
export class ProductsComponent implements OnInit {
  products: any[] = [];
  model: any = { name: '', price: null, description: '' };
  editingId: string | null = null;

  constructor(private service: ProductService) {}

  ngOnInit() {
    this.load();
  }

  async load() {
    this.products = await this.service.list();
  }

  async save() {
    if (this.editingId) {
      await this.service.update(this.editingId, this.model);
      this.editingId = null;
    } else {
      await this.service.create(this.model);
    }
    this.model = { name: '', price: null, description: '' };
    await this.load();
  }

  edit(p: any) {
    this.editingId = p.id;
    this.model = { name: p.name, price: p.price, description: p.description };
  }

  async remove(id: string) {
    await this.service.delete(id);
    await this.load();
  }
}
