<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { auth } from '../firebase/index'; 
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  GoogleAuthProvider, 
  signInWithPopup 
} from 'firebase/auth';

const router = useRouter();

// Variáveis reativas para capturar o que o usuário digita
const email = ref('');
const password = ref('');
const errMsg = ref(''); // Para mostrar erros na tela

// Função de Login
const login = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, password.value);
    console.log("Login realizado com sucesso!");
    router.push('/Home'); // Manda para a página principal
  } catch (error) {
    console.error(error.code);
    switch (error.code) {
      case 'auth/invalid-email':
        errMsg.value = 'E-mail inválido.';
        break;
      case 'auth/user-not-found':
        errMsg.value = 'Nenhuma conta encontrada com esse e-mail.';
        break;
      case 'auth/wrong-password':
        errMsg.value = 'Senha incorreta.';
        break;
      default:
        errMsg.value = 'Email ou senha incorretos.';
        break;
    }
  }
};

// Função de Cadastro (Registro)
const register = async () => {
  try {
    await createUserWithEmailAndPassword(auth, email.value, password.value);
    alert("Conta criada com sucesso! Bem-vindo.");
    router.push('/Home');
  } catch (error) {
    console.error(error.code);
    if (error.code === 'auth/email-already-in-use') {
        errMsg.value = "Este e-mail já está sendo usado.";
    } else {
        errMsg.value = "Erro ao criar conta: " + error.message;
    }
  }
};

// Função de Login com Google
const signInWithGoogle = async () => {
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        router.push('/Home');
    } catch (error) {
        errMsg.value = "Erro no Google Login: " + error.message;
    }
}
</script>

<template>
  <div class="login-container">
    <h1>Finanças App</h1>
    <p>Controle seu dinheiro</p>

    <div class="form-group">
      <input type="text" placeholder="E-mail" v-model="email" />
      <input type="password" placeholder="Senha" v-model="password" />
    </div>

    <p v-if="errMsg" class="error">{{ errMsg }}</p>

    <div class="buttons">
      <button @click="login" class="btn-primary">Entrar</button>
      <button @click="register" class="btn-secondary">Criar Conta</button>
    </div>

    <div class="divider">ou</div>

    <button @click="signInWithGoogle" class="btn-google">
      Entrar com Google
    </button>
  </div>
</template>

<style scoped>
/* Estilo simples focado em Mobile */
.login-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  padding: 20px;
  background-color: #f4f6f8;
  font-family: Arial, sans-serif;
}

h1 {
  color: #2c3e50;
  margin-bottom: 5px;
}

p {
  color: #7f8c8d;
  margin-bottom: 30px;
}

.form-group {
  width: 100%;
  max-width: 350px;
}

input {
  width: 100%;
  padding: 15px;
  margin-bottom: 15px;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-sizing: border-box; /* Garante que o padding não aumente a largura */
}

.buttons {
  width: 100%;
  max-width: 350px;
  display: flex;
  gap: 10px;
}

button {
  flex: 1;
  padding: 15px;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: 0.3s;
}

.btn-primary {
  background-color: #42b983;
  color: white;
}

.btn-secondary {
  background-color: #fff;
  border: 1px solid #42b983;
  color: #42b983;
}

.divider {
  margin: 20px 0;
  color: #aaa;
  font-size: 14px;
}

.btn-google {
  background-color: #db4437;
  color: white;
  width: 100%;
  max-width: 350px;
}

.error {
  color: red;
  font-size: 14px;
  margin-bottom: 15px;
}
</style>