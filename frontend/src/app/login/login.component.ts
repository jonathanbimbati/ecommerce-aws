import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
  <div class="container mt-5">
    <div class="row justify-content-center">
      <div class="col-md-4">
        <h3 class="mb-3">{{ registerMode ? 'Registrar' : 'Login' }}</h3>
        <form (ngSubmit)="submit()">
          <div class="mb-2">
            <input [(ngModel)]="username" name="username" class="form-control" placeholder="Usuário" required />
          </div>
          <div class="mb-2">
            <input [(ngModel)]="password" name="password" type="password" class="form-control" placeholder="Senha" required />
          </div>
          <div class="mb-2" *ngIf="registerMode">
            <input [(ngModel)]="name" name="name" class="form-control" placeholder="Nome (opcional)" />
          </div>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-primary" type="submit">{{ registerMode ? 'Criar conta' : 'Entrar' }}</button>
            <button type="button" class="btn btn-link p-0" (click)="toggleMode()">
              {{ registerMode ? 'Já tenho conta (Login)' : 'Não tenho conta (Registrar)' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  name = '';
  registerMode = false;
  constructor(private auth: AuthService, private router: Router) {}

  toggleMode() { this.registerMode = !this.registerMode; }

  async submit() {
    const ok = this.registerMode
      ? await this.auth.register(this.username, this.password, this.name)
      : await this.auth.login(this.username, this.password);
    if (ok) this.router.navigate(['/']);
    else alert(this.registerMode ? 'Registro falhou' : 'Credenciais inválidas');
  }
}
