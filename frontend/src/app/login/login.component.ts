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
        <h3>Login</h3>
        <form (ngSubmit)="doLogin()">
          <div class="mb-2">
            <input [(ngModel)]="username" name="username" class="form-control" placeholder="Usuário" required />
          </div>
          <div class="mb-2">
            <input [(ngModel)]="password" name="password" type="password" class="form-control" placeholder="Senha" required />
          </div>
          <button class="btn btn-primary" type="submit">Entrar</button>
        </form>

        <div class="text-muted small mt-2">
          Dica: usuário padrão para testes é <code>admin</code> / <code>admin</code>.
        </div>

        <hr class="my-4"/>
        <h5>Registrar</h5>
        <form (ngSubmit)="doRegister()">
          <div class="mb-2">
            <input [(ngModel)]="newName" name="newName" class="form-control" placeholder="Nome (opcional)" />
          </div>
          <div class="mb-2">
            <input [(ngModel)]="newUsername" name="newUsername" class="form-control" placeholder="Novo usuário" required />
          </div>
          <div class="mb-2">
            <input [(ngModel)]="newPassword" name="newPassword" type="password" class="form-control" placeholder="Senha" required />
          </div>
          <button class="btn btn-outline-primary" type="submit">Criar conta</button>
        </form>

        <hr class="my-4"/>
        <h5>Já tem um JWT do Cognito?</h5>
        <p class="text-muted small">Cole abaixo o IdToken (JWT) válido para acessar a API protegida.</p>
        <form (ngSubmit)="useToken()">
          <div class="mb-2">
            <textarea [(ngModel)]="pastedToken" name="pastedToken" rows="4" class="form-control" placeholder="Cole aqui o IdToken JWT"></textarea>
          </div>
          <button class="btn btn-outline-success" type="submit">Usar token</button>
        </form>
      </div>
    </div>
  </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  newUsername = '';
  newPassword = '';
  newName = '';
  pastedToken = '';
  constructor(private auth: AuthService, private router: Router) {}

  async doLogin() {
    const ok = await this.auth.login(this.username, this.password);
    if (ok) {
      this.router.navigate(['/']);
    } else {
      alert('Credenciais inválidas');
    }
  }

  async doRegister() {
    const ok = await this.auth.register(this.newUsername, this.newPassword, this.newName);
    if (ok) {
      this.router.navigate(['/']);
    } else {
      alert('Falha ao registrar. Tente outro usuário ou verifique o backend.');
    }
  }

  async useToken() {
    const ok = this.auth.setToken(this.pastedToken.trim());
    if (ok) {
      this.router.navigate(['/']);
    } else {
      alert('Token inválido. Verifique e tente novamente.');
    }
  }
}
