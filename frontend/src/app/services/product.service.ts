import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
declare const window: any;

@Injectable({ providedIn: 'root' })
export class ProductService {
  private apiBase = (window && window.__env && window.__env.API_URL) ? window.__env.API_URL : '';
  base = (this.apiBase || '') + '/api/products';
  uploadsBase = (this.apiBase || '') + '/api/uploads';
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

  // S3 direct upload helpers
  async presignUpload(fileName: string, contentType: string) {
    const size = (fileName as any).size ? (fileName as any).size : undefined;
    return await firstValueFrom(this.http.post<any>(`${this.uploadsBase}/presign`, { fileName, contentType, size }));
  }

  async putToS3(uploadUrl: string, file: File, contentType: string) {
    // Use fetch to avoid Angular interceptors/CORS complications and to set raw body
    const resp = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
    if (!resp.ok) throw new Error(`S3 upload failed with status ${resp.status}`);
    return true;
  }

  async putToS3WithProgress(uploadUrl: string, file: File, contentType: string, onProgress?: (percent: number) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', contentType);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && onProgress) {
            const pct = Math.round((evt.loaded / evt.total) * 100);
            onProgress(pct);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`S3 upload failed with status ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error during S3 upload'));
        xhr.send(file);
      } catch (e) {
        reject(e);
      }
    });
  }
}
