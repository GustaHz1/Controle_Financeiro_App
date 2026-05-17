<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { auth } from '../firebase/index'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithCredential,
  signInWithPopup,
  updateProfile 
} from 'firebase/auth';

// 1. Importação do Plugin Nativo e Core do Capacitor
import { GoogleAuth } from '@codetrix-studio/capacitor-google-auth';
import { Capacitor } from '@capacitor/core';

const router = useRouter();
const isLoading = ref(false);

// ==========================================
// INICIALIZAÇÃO DO GOOGLE AUTH NATIVO
// ==========================================
if (Capacitor.getPlatform() !== 'web') {
  GoogleAuth.initialize({
    clientId: '845848521181-vki43no1tmv5mo89naammvc3t1o5t2j0.apps.googleusercontent.com',
    scopes: ['profile', 'email'],
    grantOfflineAccess: true,
  });
}

// ==========================================
// ESTADOS DA TELA DE LOGIN
// ==========================================
const loginEmail = ref('');
const loginPassword = ref('');
const loginErrMsg = ref('');

// ==========================================
// ESTADOS DO MODAL DE REGISTRO
// ==========================================
const showModal = ref(false);
const regName = ref('');
const regEmail = ref('');
const regPassword = ref('');
const regErrMsg = ref('');

const openRegisterModal = () => {
  showModal.value = true;
  regErrMsg.value = '';
  regName.value = '';
  regEmail.value = '';
  regPassword.value = '';
};

// ==========================================
// FUNÇÕES DE AUTENTICAÇÃO
// ==========================================

const login = async () => {
  if (!loginEmail.value || !loginPassword.value) {
    loginErrMsg.value = 'Preencha e-mail e senha para entrar.';
    return;
  }

  isLoading.value = true;
  loginErrMsg.value = '';

  try {
    await signInWithEmailAndPassword(auth, loginEmail.value, loginPassword.value);
    router.push('/Home'); 
  } catch (error) {
    console.error("Erro no login:", error.code);
    loginErrMsg.value = 'E-mail ou senha incorretos.';
  } finally {
    isLoading.value = false;
  }
};

const register = async () => {
  regErrMsg.value = '';

  if (!regName.value || !regEmail.value || !regPassword.value) {
    regErrMsg.value = 'Todos os campos são obrigatórios.';
    return;
  }

  // Validação de segurança da senha
  const passwordRegex = /^(?=.*[A-Z])(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/;
  if (!passwordRegex.test(regPassword.value)) {
    regErrMsg.value = 'A senha exige mín. 8 caracteres, 1 maiúscula e 1 especial.';
    return;
  }

  isLoading.value = true;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, regEmail.value, regPassword.value);
    
    await updateProfile(userCredential.user, {
      displayName: regName.value
    });

    alert("Conta criada com sucesso! Redirecionando...");
    showModal.value = false;
    router.push('/Home');
  } catch (error) {
    console.error("Erro no registro:", error.code);
    if (error.code === 'auth/email-already-in-use') {
      regErrMsg.value = 'Este e-mail já está sendo usado.';
    } else {
      regErrMsg.value = 'Erro ao criar conta. Tente novamente.';
    }
  } finally {
    isLoading.value = false;
  }
};

// ==========================================
// LOGIN HÍBRIDO (WEB + ANDROID)
// ==========================================
const signInWithGoogle = async () => {
  isLoading.value = true;
  loginErrMsg.value = '';

  try {
    if (Capacitor.getPlatform() === 'web') {
      // FLUXO WEB: Usa o popup padrão do Firebase
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/Home');
      
    } else {
      // FLUXO ANDROID: Chama a gaveta nativa e converte o token
      const googleUser = await GoogleAuth.signIn();
      const credential = GoogleAuthProvider.credential(googleUser.authentication.idToken);
      await signInWithCredential(auth, credential);
      router.push('/Home');
    }
  } catch (error) {
    console.error("Erro no Google Sign-In:", error);
    loginErrMsg.value = "Falha ao conectar com o Google.";
  } finally {
    isLoading.value = false;
  }
};
</script>
<template>
  <div class="login-wrapper">
    <!-- Círculos decorativos no fundo -->
    <div class="circle-bg circle-1"></div>
    <div class="circle-bg circle-2"></div>

    <div class="login-container">
      
      <!-- Cabeçalho Informativo e Atraente -->
      <div class="brand-header">
        <div class="logo-placeholder">💎</div>
        <h1>Finanças App</h1>
        <p>Segurança e controle total na palma da sua mão.</p>
      </div>

      <!-- FORMULÁRIO PRINCIPAL DE LOGIN -->
      <div class="form-card">
        <div class="form-group">
          <label>E-mail de Acesso</label>
          <input 
            type="email" 
            placeholder="seu@email.com" 
            v-model="loginEmail" 
            :disabled="isLoading"
            class="modern-input"
          />
        </div>
        
        <div class="form-group">
          <label>Senha</label>
          <input 
            type="password" 
            placeholder="••••••••" 
            v-model="loginPassword" 
            :disabled="isLoading"
            class="modern-input"
          />
        </div>

        <p v-if="loginErrMsg" class="error fade-in">{{ loginErrMsg }}</p>

        <div class="buttons-column">
          <button @click="login" class="btn-primary" :disabled="isLoading">
            {{ isLoading ? 'Autenticando...' : 'Acessar minha conta' }}
          </button>
          
          <div class="divider"><span>ou acesse com</span></div>

          <button @click="signInWithGoogle" class="btn-google" :disabled="isLoading">
            <svg class="google-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="20px" height="20px">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.73 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Entrar com Google
          </button>
        </div>
      </div>

      <!-- Rodapé para Criar Conta -->
      <div class="register-footer">
        <p>Ainda não faz parte?</p>
        <button @click="openRegisterModal" class="btn-text" :disabled="isLoading">
          Crie sua conta gratuitamente
        </button>
      </div>

    </div>

    <!-- MODAL DE CRIAÇÃO DE CONTA -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal-content fade-in-up">
        <div class="modal-header">
          <h2>Criar Conta</h2>
          <p>Comece a organizar sua vida financeira hoje.</p>
        </div>
        
        <div class="form-group">
          <input type="text" placeholder="Como devemos te chamar?" v-model="regName" :disabled="isLoading" class="modern-input" />
        </div>
        <div class="form-group">
          <input type="email" placeholder="Seu melhor e-mail" v-model="regEmail" :disabled="isLoading" class="modern-input" />
        </div>
        <div class="form-group">
          <input type="password" placeholder="Crie uma senha forte" v-model="regPassword" :disabled="isLoading" class="modern-input" />
          <small class="password-hint">Mínimo 8 dígitos, 1 letra maiúscula e 1 caractere especial (!@#).</small>
        </div>

        <p v-if="regErrMsg" class="error fade-in">{{ regErrMsg }}</p>

        <div class="modal-buttons">
          <button @click="showModal = false" class="btn-secondary" :disabled="isLoading">Cancelar</button>
          <button @click="register" class="btn-primary" :disabled="isLoading">
            {{ isLoading ? 'Criando...' : 'Concluir Cadastro' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ==========================================
   ESTILOS PREMIUM (FINTECH STYLE)
   ========================================== */
.login-wrapper {
  position: relative;
  min-height: 100vh;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Poppins', sans-serif;
}

/* Decoração de Fundo para atração visual */
.circle-bg {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  z-index: 0;
}
.circle-1 {
  width: 300px;
  height: 300px;
  background: rgba(130, 10, 209, 0.15); /* Roxo Nubank Suave */
  top: -50px;
  left: -50px;
}
.circle-2 {
  width: 250px;
  height: 250px;
  background: rgba(0, 184, 148, 0.15); /* Verde Suave */
  bottom: -50px;
  right: -50px;
}

.login-container {
  width: 100%;
  max-width: 400px;
  padding: 20px;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* Cabeçalho */
.brand-header {
  text-align: center;
  margin-bottom: 10px;
}
.logo-placeholder {
  font-size: 3rem;
  margin-bottom: 10px;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
}
.brand-header h1 {
  color: #1a1a1a;
  font-size: 1.8rem;
  font-weight: 700;
  margin: 0 0 5px 0;
}
.brand-header p {
  color: #666;
  font-size: 0.9rem;
  margin: 0;
}

/* Cartão do Formulário */
.form-card {
  background: #ffffff;
  padding: 30px 20px;
  border-radius: 20px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.5);
}

.form-group {
  margin-bottom: 15px;
  width: 100%;
}
.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 600;
  color: #444;
  margin-bottom: 8px;
}
.modern-input {
  width: 100%;
  padding: 14px 15px;
  border: 1px solid #ddd;
  border-radius: 12px;
  font-size: 1rem;
  background: #fdfdfd;
  transition: all 0.3s ease;
  box-sizing: border-box;
}
.modern-input:focus {
  border-color: #820ad1;
  background: #ffffff;
  box-shadow: 0 0 0 4px rgba(130, 10, 209, 0.1);
  outline: none;
}
.modern-input:disabled {
  background: #f1f1f1;
  color: #999;
}

/* Botões */
.buttons-column {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-top: 20px;
}
button {
  width: 100%;
  padding: 15px;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: none;
}
button:active:not(:disabled) { transform: scale(0.98); }
button:disabled { opacity: 0.6; cursor: not-allowed; }

.btn-primary {
  background: #820ad1;
  color: #ffffff;
  box-shadow: 0 4px 15px rgba(130, 10, 209, 0.3);
}
.btn-primary:hover:not(:disabled) { background: #6b08ad; }

.btn-secondary {
  background: #f8f9fa;
  color: #333;
  border: 1px solid #ddd;
}
.btn-secondary:hover:not(:disabled) { background: #eeeeee; }

.btn-google {
  background: #ffffff;
  color: #444;
  border: 1px solid #ddd;
  box-shadow: 0 2px 5px rgba(0,0,0,0.02);
}

.divider {
  text-align: center;
  position: relative;
  margin: 10px 0;
}
.divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #eee;
  z-index: 1;
}
.divider span {
  position: relative;
  background: #ffffff;
  padding: 0 15px;
  color: #aaa;
  font-size: 0.85rem;
  z-index: 2;
}

/* Rodapé */
.register-footer {
  text-align: center;
  margin-top: 10px;
}
.register-footer p {
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 5px;
}
.btn-text {
  background: none;
  border: none;
  color: #820ad1;
  font-weight: 700;
  padding: 0;
  box-shadow: none;
}

/* Mensagens de Erro */
.error {
  color: #d63031;
  font-size: 0.85rem;
  text-align: center;
  background: #ffeaa7;
  padding: 10px;
  border-radius: 8px;
  margin: 10px 0 0 0;
}

/* ==========================================
   MODAL DE REGISTRO
   ========================================== */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}
.modal-content {
  background: #ffffff;
  padding: 30px 20px;
  border-radius: 20px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}
.modal-header { text-align: center; margin-bottom: 25px; }
.modal-header h2 { margin: 0 0 5px 0; color: #1a1a1a; font-size: 1.5rem; }
.modal-header p { margin: 0; color: #666; font-size: 0.9rem; }

.password-hint {
  display: block;
  font-size: 0.75rem;
  color: #888;
  margin-top: 5px;
  line-height: 1.3;
}
.modal-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

/* Animações */
.fade-in { animation: fadeIn 0.3s ease; }
.fade-in-up { animation: fadeInUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275); }

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>