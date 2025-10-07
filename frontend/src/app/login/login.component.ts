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
      </div>
    </div>
  </div>
  `
})
export class LoginComponent {
  username = '';
  password = '';
  constructor(private auth: AuthService, private router: Router) {}

  doLogin() {
    if (this.auth.login(this.username, this.password)) {
      this.router.navigate(['/']);
    } else {
      alert('Credenciais inválidas');
    }
  }
}
