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
  model: any = { name: '', price: null, description: '', imageUrl: '' };
  editingId: string | null = null;
  pendingUpload: { file?: File, uploading: boolean, error?: string, progress?: number } = { uploading: false };
  readonly MAX_MB = 5;
  readonly ALLOWED_TYPES = ['image/png', 'image/jpeg'];
  // Modal state
  private bootstrap: any = (window as any)['bootstrap'];
  formModalId = 'productModal';
  detailsModalId = 'detailsModal';
  selected: any = null;
  pageSize = 8;
  currentPage = 1;

  constructor(private service: ProductService) {}

  ngOnInit() {
    this.load();
  }

  async load() {
    this.products = await this.service.list();
    // Reset pagination if current page exceeds length
    const totalPages = this.totalPages;
    if (this.currentPage > totalPages) this.currentPage = totalPages || 1;
  }

  async save() {
    if (this.editingId) {
      await this.service.update(this.editingId, this.model);
      this.editingId = null;
    } else {
      await this.service.create(this.model);
    }
    this.model = { name: '', price: null, description: '', imageUrl: '' };
    await this.load();
    this.hideForm();
  }

  edit(p: any) {
    this.editingId = p.id;
    this.model = { name: p.name, price: p.price, description: p.description, imageUrl: p.imageUrl || '' };
    this.showForm();
  }

  async remove(id: string) {
    await this.service.delete(id);
    await this.load();
  }

  newProduct() {
    this.editingId = null;
    this.model = { name: '', price: null, description: '', imageUrl: '' };
    this.showForm();
  }

  async onFileSelected(evt: any) {
    const file: File | undefined = evt?.target?.files?.[0];
    this.pendingUpload = { file, uploading: false, error: undefined, progress: 0 };
    if (!file) return;
    // Validate type and size
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      this.pendingUpload.error = 'Apenas PNG e JPEG são permitidos.';
      return;
    }
    const maxBytes = this.MAX_MB * 1024 * 1024;
    if (file.size > maxBytes) {
      this.pendingUpload.error = `Arquivo muito grande. Máximo ${this.MAX_MB}MB.`;
      return;
    }
    try {
      this.pendingUpload.uploading = true;
      const presign = await this.service.presignUpload(file.name, file.type || 'application/octet-stream');
      await this.service.putToS3WithProgress(
        presign.uploadUrl,
        file,
        file.type || 'application/octet-stream',
        (pct) => { this.pendingUpload.progress = pct; }
      );
      this.model.imageUrl = presign.objectUrl;
      this.pendingUpload.uploading = false;
    } catch (e: any) {
      this.pendingUpload.error = e?.message || String(e);
      this.pendingUpload.uploading = false;
    }
  }

  showForm() {
    const el = document.getElementById(this.formModalId);
    if (!el || !this.bootstrap) return;
    this.bootstrap.Modal.getOrCreateInstance(el).show();
  }

  hideForm() {
    const el = document.getElementById(this.formModalId);
    if (!el || !this.bootstrap) return;
    this.bootstrap.Modal.getOrCreateInstance(el).hide();
  }

  openDetails(p: any) {
    this.selected = p;
    const el = document.getElementById(this.detailsModalId);
    if (!el || !this.bootstrap) return;
    this.bootstrap.Modal.getOrCreateInstance(el).show();
  }

  closeDetails() {
    const el = document.getElementById(this.detailsModalId);
    if (!el || !this.bootstrap) return;
    this.bootstrap.Modal.getOrCreateInstance(el).hide();
    this.selected = null;
  }

  // Pagination helpers
  get totalPages(): number {
    return Math.ceil((this.products?.length || 0) / this.pageSize);
  }

  get paginated(): any[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return (this.products || []).slice(start, start + this.pageSize);
  }

  goTo(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }
}
