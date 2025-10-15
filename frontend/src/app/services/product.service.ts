import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
declare const window: any;

@Injectable({ providedIn: 'root' })
export class ProductService {
  private apiBase = (window && window.__env && window.__env.API_URL) ? window.__env.API_URL : '';
  base = (this.apiBase || '') + '/api/products';
  constructor(private http: HttpClient) {}

  async list() {
    return await firstValueFrom(this.http.get<any[]>(this.base));
  }

  async get(id: string) {
    return await firstValueFrom(this.http.get<any>(`${this.base}/${id}`));
  }

  async create(p: any) {
    return await firstValueFrom(this.http.post<any>(this.base, p));
  }

  async update(id: string, p: any) {
    return await firstValueFrom(this.http.put<any>(`${this.base}/${id}`, p));
  }

  async delete(id: string) {
    return await firstValueFrom(this.http.delete(`${this.base}/${id}`));
  }
}
