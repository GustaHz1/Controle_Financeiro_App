<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { auth, db } from '../firebase/index';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const router = useRouter();

// --- DADOS DO USUÁRIO ---
const userName = ref('Usuário');
const userPhoto = ref('https://cdn-icons-png.flaticon.com/512/149/149071.png');
const salarioBruto = ref(0);
const mostrarDetalhesSalario = ref(false);
const carregando = ref(true);
const mostrarModalConquistas = ref(false); // Controle do Modal
const notificacaoAtiva = ref(null); // Para o Toast

// --- LISTAS ---
const descontosExtras = ref([]);
const novoDescontoNome = ref('');
const novoDescontoValor = ref('');

const transacoes = ref([]);
const novaTransacaoNome = ref('');
const novaTransacaoValor = ref('');
const tipoTransacao = ref('despesa');
const categoriaTransacao = ref('Outros');

// --- GAMIFICAÇÃO: DEFINIÇÃO DAS INSÍGNIAS ---
const todasInsignias = [
    { id: 'primeiro_passo', nome: 'Primeiro Passo', desc: 'Fez o primeiro registro.', icon: '🚀' },
    { id: 'poupador_iniciante', nome: 'Poupador Jr.', desc: 'Terminou o mês com saldo positivo.', icon: '🐷' },
    { id: 'milionario', nome: 'Barão', desc: 'Acumulou mais de R$ 5.000 em saldo.', icon: '🎩' },
    { id: 'controlado', nome: 'Na Rédea', desc: 'Registrou mais de 5 despesas.', icon: '📝' },
    { id: 'investidor', nome: 'Foco na Meta', desc: 'Criou sua primeira meta.', icon: '🎯' }
];

// IDs das insígnias que o usuário já tem
const insigniasDesbloqueadas = ref([]);

// --- METAS ---
const metas = ref([
    { id: 1, nome: 'Reserva de Emergência', alvo: 5000, atual: 1200, icon: '🛡️' },
]);

const categorias = { 'Comida': '🍔', 'Transporte': '🚗', 'Lazer': '🎮', 'Contas': '💡', 'Saúde': '💊', 'Outros': '📦' };

// --- NOTIFICAÇÃO (TOAST) ---
const mostrarNotificacao = (titulo, msg, tipo = 'sucesso') => {
    notificacaoAtiva.value = { titulo, msg, tipo };
    setTimeout(() => { notificacaoAtiva.value = null; }, 4000); // Some em 4s
};

// --- LÓGICA DE GAMIFICAÇÃO ---
const verificarConquistas = () => {
    const novas = [];

    // 1. Conquista: Primeiro Passo (Se tiver pelo menos 1 transação)
    if (transacoes.value.length > 0 && !insigniasDesbloqueadas.value.includes('primeiro_passo')) {
        novas.push('primeiro_passo');
    }

    // 2. Conquista: Barão (Saldo > 5000)
    if (saldoFinal.value >= 5000 && !insigniasDesbloqueadas.value.includes('milionario')) {
        novas.push('milionario');
    }

    // 3. Conquista: Controlado (Mais de 5 despesas)
    const numDespesas = transacoes.value.filter(t => t.tipo === 'despesa').length;
    if (numDespesas >= 5 && !insigniasDesbloqueadas.value.includes('controlado')) {
        novas.push('controlado');
    }

    // Se desbloqueou algo novo, salva e notifica
    if (novas.length > 0) {
        insigniasDesbloqueadas.value = [...insigniasDesbloqueadas.value, ...novas];
        const badgeInfo = todasInsignias.find(b => b.id === novas[0]);

        mostrarNotificacao('🏆 Nova Insígnia!', `Você desbloqueou: ${badgeInfo.nome}`, 'conquista');
        salvarNoFirebase(); // Salva a nova conquista no banco
    }
};

// --- FIREBASE ---
const salvarNoFirebase = async () => {
    if (!auth.currentUser) return;
    try {
        await setDoc(doc(db, "users", auth.currentUser.uid), {
            salarioBruto: salarioBruto.value,
            descontosExtras: descontosExtras.value,
            transacoes: transacoes.value,
            insignias: insigniasDesbloqueadas.value // Salvando as conquistas
        }, { merge: true });
    } catch (error) { console.error(error); }
};

const carregarDados = async (user) => {
    userName.value = user.displayName || 'Usuário';
    if (user.photoURL) userPhoto.value = user.photoURL;

    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
        const dados = docSnap.data();
        salarioBruto.value = dados.salarioBruto || 0;
        descontosExtras.value = dados.descontosExtras || [];
        transacoes.value = dados.transacoes || [];
        insigniasDesbloqueadas.value = dados.insignias || [];
    }
    carregando.value = false;
};

onMounted(() => {
    onAuthStateChanged(auth, (user) => {
        if (user) carregarDados(user);
        else router.push('/');
    });
});

// --- CÁLCULOS ---
const inss = computed(() => {
    const s = salarioBruto.value;
    if (!s) return 0;
    if (s <= 1412) return s * 0.075;
    if (s <= 2666.68) return (1412 * 0.075) + ((s - 1412) * 0.09);
    if (s <= 4000.03) return 105.9 + 112.92 + ((s - 2666.68) * 0.12);
    if (s <= 7786.02) return 105.9 + 112.92 + 160.0 + ((s - 4000.03) * 0.14);
    return 908.85;
});
const irrf = computed(() => {
    const b = salarioBruto.value - inss.value;
    if (b <= 2112) return 0;
    if (b <= 2826.65) return (b * 0.075) - 158.40;
    if (b <= 3751.05) return (b * 0.15) - 354.80;
    if (b <= 4664.68) return (b * 0.225) - 636.13;
    return (b * 0.275) - 869.36;
});
const totalDescontosExtras = computed(() => descontosExtras.value.reduce((a, c) => a + c.valor, 0));
const salarioLiquido = computed(() => Math.max(0, salarioBruto.value - inss.value - irrf.value - totalDescontosExtras.value));
const totalGastos = computed(() => transacoes.value.filter(t => t.tipo === 'despesa').reduce((a, c) => a + c.valor, 0));
const totalRendaExtra = computed(() => transacoes.value.filter(t => t.tipo === 'receita').reduce((a, c) => a + c.valor, 0));
const saldoFinal = computed(() => salarioLiquido.value + totalRendaExtra.value - totalGastos.value);
const formatMoney = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// --- AÇÕES ---
const atualizarSalario = () => { salvarNoFirebase(); verificarConquistas(); }; // Check ao mudar salario

const addDescontoExtra = () => {
    if (!novoDescontoNome.value || !novoDescontoValor.value) return;
    descontosExtras.value.push({ id: Date.now(), nome: novoDescontoNome.value, valor: parseFloat(novoDescontoValor.value) });
    novoDescontoNome.value = ''; novoDescontoValor.value = '';
    salvarNoFirebase();
};
const removeDesconto = (id) => { descontosExtras.value = descontosExtras.value.filter(d => d.id !== id); salvarNoFirebase(); };

const addTransacao = () => {
    if (!novaTransacaoNome.value || !novaTransacaoValor.value) return;
    transacoes.value.unshift({
        id: Date.now(),
        nome: novaTransacaoNome.value,
        valor: parseFloat(novaTransacaoValor.value),
        tipo: tipoTransacao.value,
        categoria: categoriaTransacao.value,
        data: new Date().toISOString()
    });
    novaTransacaoNome.value = ''; novaTransacaoValor.value = '';

    // Verificar conquistas logo após adicionar
    verificarConquistas();
    salvarNoFirebase();

    // Feedback visual simples
    mostrarNotificacao('Sucesso', 'Movimentação registrada!', 'padrao');
};
const removeTransacao = (id) => { transacoes.value = transacoes.value.filter(t => t.id !== id); salvarNoFirebase(); };
const irParaDashboard = () => router.push('/dashboard');
</script>

<template>
    <div class="app-container">

        <header class="header-modern">
            <div class="user-profile">
                <img :src="userPhoto" alt="Perfil" class="avatar" />
                <div class="user-info">
                    <span class="greeting">Olá, {{ userName.split(' ')[0] }}!</span>
                    <div class="badges-mini" @click="mostrarModalConquistas = true">
                        <span v-for="bId in insigniasDesbloqueadas.slice(0, 3)" :key="bId">
                            {{todasInsignias.find(i => i.id === bId)?.icon}}
                        </span>
                        <span class="plus-badge" v-if="insigniasDesbloqueadas.length === 0">🏆 Ver Conquistas</span>
                    </div>
                </div>
                <button @click="mostrarModalConquistas = true" class="btn-chart relative">
                    🏆
                    <span class="badge-count" v-if="insigniasDesbloqueadas.length > 0">{{ insigniasDesbloqueadas.length
                    }}</span>
                </button>
            </div>

            <div class="balance-big">
                <span class="label">Saldo em Conta</span>
                <h1 :class="{ 'negative': saldoFinal < 0 }">{{ formatMoney(saldoFinal) }}</h1>
            </div>
        </header>

        <main class="content-scroll">

            <div class="section-title">🎯 Minhas Metas</div>
            <div class="goals-carousel">
                <div class="goal-card" v-for="meta in metas" :key="meta.id">
                    <div class="goal-icon">{{ meta.icon }}</div>
                    <div class="goal-info">
                        <span>{{ meta.nome }}</span>
                        <div class="progress-bar">
                            <div class="fill" :style="{ width: (meta.atual / meta.alvo * 100) + '%' }"></div>
                        </div>
                        <small>{{ formatMoney(meta.atual) }} / {{ formatMoney(meta.alvo) }}</small>
                    </div>
                </div>
            </div>

            <section class="card salary-card">
                <div class="card-header" @click="mostrarDetalhesSalario = !mostrarDetalhesSalario">
                    <div class="row-center">
                        <span class="icon-circle">💼</span>
                        <div class="col">
                            <h3>Salário Líquido</h3>
                            <small class="text-muted">{{ mostrarDetalhesSalario ? 'Fechar' : 'Ver detalhes' }}</small>
                        </div>
                    </div>
                    <div class="salary-value">{{ formatMoney(salarioLiquido) }}</div>
                </div>

                <div v-if="mostrarDetalhesSalario" class="card-body fade-in">
                    <div class="input-modern">
                        <label>Bruto</label>
                        <input type="number" v-model="salarioBruto" placeholder="0,00" @change="atualizarSalario" />
                    </div>
                </div>
            </section>

            <section class="card transaction-card">
                <h3>📝 Novo Lançamento</h3>
                <div class="input-grid">
                    <select v-model="tipoTransacao" class="input-modern">
                        <option value="despesa">💸 Gasto</option>
                        <option value="receita">💰 Receita</option>
                    </select>
                    <select v-model="categoriaTransacao" class="input-modern">
                        <option v-for="(icon, name) in categorias" :value="name" :key="name">{{ icon }} {{ name }}
                        </option>
                    </select>
                    <input type="text" v-model="novaTransacaoNome" placeholder="Descrição"
                        class="input-modern full-width" />
                    <input type="number" v-model="novaTransacaoValor" placeholder="Valor"
                        class="input-modern full-width" />
                    <button @click="addTransacao" class="btn-launch full-width">Lançar</button>
                </div>
            </section>

            <div class="transactions-area">
                <ul class="t-list">
                    <li v-for="t in transacoes" :key="t.id" class="t-item">
                        <div class="t-left">
                            <div class="cat-icon">{{ categorias[t.categoria] || '📦' }}</div>
                            <div class="t-desc"><strong>{{ t.nome }}</strong></div>
                        </div>
                        <span :class="t.tipo === 'receita' ? 'val-green' : 'val-red'">{{ formatMoney(t.valor) }}</span>
                    </li>
                </ul>
            </div>
        </main>

        <div v-if="mostrarModalConquistas" class="modal-overlay" @click.self="mostrarModalConquistas = false">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>🏆 Sala de Troféus</h2>
                    <button @click="mostrarModalConquistas = false" class="close-btn">×</button>
                </div>
                <div class="badges-grid">
                    <div v-for="badge in todasInsignias" :key="badge.id" class="badge-item"
                        :class="{ 'locked': !insigniasDesbloqueadas.includes(badge.id) }">
                        <div class="badge-icon">{{ badge.icon }}</div>
                        <div class="badge-text">
                            <strong>{{ badge.nome }}</strong>
                            <p>{{ badge.desc }}</p>
                        </div>
                        <div class="status-icon">
                            {{ insigniasDesbloqueadas.includes(badge.id) ? '✅' : '🔒' }}
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div v-if="notificacaoAtiva" class="toast-notification" :class="notificacaoAtiva.tipo">
            <div class="toast-icon">{{ notificacaoAtiva.tipo === 'conquista' ? '🏆' : '🔔' }}</div>
            <div class="toast-content">
                <strong>{{ notificacaoAtiva.titulo }}</strong>
                <p>{{ notificacaoAtiva.msg }}</p>
            </div>
        </div>

    </div>
</template>

<style scoped>
.badges-mini {
    display: flex;
    gap: 5px;
    font-size: 1.2rem;
    margin-top: 5px;
    cursor: pointer;
}

.plus-badge {
    font-size: 0.8rem;
    background: rgba(255, 255, 255, 0.2);
    padding: 2px 8px;
    border-radius: 10px;
}

.relative {
    position: relative;
}

.badge-count {
    position: absolute;
    top: -5px;
    right: -5px;
    background: #ff7675;
    color: white;
    font-size: 0.7rem;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #820ad1;
}

/* MODAL */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.modal-content {
    background: white;
    width: 90%;
    max-width: 400px;
    border-radius: 20px;
    padding: 20px;
    animation: popUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    line-height: 1;
}

.badges-grid {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.badge-item {
    display: flex;
    align-items: center;
    gap: 15px;
    padding: 10px;
    border-radius: 12px;
    background: #f8f9fa;
    border: 1px solid #eee;
}

.badge-item.locked {
    opacity: 0.5;
    filter: grayscale(1);
}

.badge-icon {
    font-size: 2rem;
}

.badge-text strong {
    display: block;
    font-size: 0.95rem;
}

.badge-text p {
    font-size: 0.8rem;
    color: #666;
    margin: 0;
}

/* TOAST NOTIFICATION */
.toast-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #333;
    color: white;
    padding: 15px 20px;
    border-radius: 50px;
    display: flex;
    align-items: center;
    gap: 15px;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    z-index: 200;
    width: 90%;
    max-width: 350px;
    animation: slideUp 0.5s ease;
}

.toast-notification.conquista {
    background: linear-gradient(135deg, #FFD700, #FDB931);
    color: #333;
}

.toast-icon {
    font-size: 1.5rem;
}

.toast-content strong {
    display: block;
    font-size: 0.9rem;
}

.toast-content p {
    font-size: 0.8rem;
    margin: 0;
    opacity: 0.9;
}

@keyframes popUp {
    from {
        transform: scale(0.8);
        opacity: 0;
    }

    to {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes slideUp {
    from {
        transform: translate(-50%, 100px);
        opacity: 0;
    }

    to {
        transform: translate(-50%, 0);
        opacity: 1;
    }
}

.app-container {
    background-color: #f8f9fa;
    min-height: 100vh;
    font-family: 'Poppins', sans-serif;
    /* Fonte mais moderna */
    color: #333;
}

/* --- HEADER --- */
.header-modern {
    background: #820ad1;
    color: white;
    padding: 20px 20px 40px 20px;
    border-bottom-left-radius: 30px;
    border-bottom-right-radius: 30px;
    box-shadow: 0 10px 30px rgba(130, 10, 209, 0.3);
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 25px;
}

.avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.5);
    object-fit: cover;
}

.user-info {
    flex: 1;
}

.greeting {
    display: block;
    font-weight: 600;
    font-size: 1.1rem;
}

.subtitle {
    font-size: 0.8rem;
    opacity: 0.8;
}

.btn-chart {
    background: rgba(255, 255, 255, 0.2);
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    font-size: 1.2rem;
    cursor: pointer;
    backdrop-filter: blur(5px);
}

.balance-big {
    text-align: center;
}

.balance-big .label {
    font-size: 0.9rem;
    opacity: 0.9;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.balance-big h1 {
    font-size: 2.5rem;
    margin: 5px 0;
    font-weight: 700;
}

.balance-big h1.negative {
    color: #ff8a8a;
}

/* --- CONTEÚDO --- */
.content-scroll {
    padding: 0 20px;
    margin-top: -30px;
    /* Sobrepõe o header */
    padding-bottom: 80px;
}

.section-title {
    font-weight: 600;
    margin: 20px 0 10px 0;
    color: #555;
    font-size: 0.95rem;
}

/* --- CARROSSEL DE METAS --- */
.goals-carousel {
    display: flex;
    gap: 15px;
    overflow-x: auto;
    padding-bottom: 10px;
    scrollbar-width: none;
    /* Esconde scrollbar Firefox */
}

.goals-carousel::-webkit-scrollbar {
    display: none;
}

/* Esconde scrollbar Chrome */

.goal-card {
    background: white;
    min-width: 160px;
    padding: 15px;
    border-radius: 16px;
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    justify-content: center;
}

.goal-card.add-goal {
    min-width: 80px;
    align-items: center;
    border: 2px dashed #ddd;
    color: #999;
    cursor: pointer;
}

.goal-icon {
    font-size: 1.5rem;
    margin-bottom: 8px;
}

.goal-info span {
    font-weight: 600;
    font-size: 0.9rem;
    display: block;
    margin-bottom: 5px;
}

.progress-bar {
    height: 6px;
    background: #eee;
    border-radius: 3px;
    margin-bottom: 5px;
    overflow: hidden;
}

.fill {
    height: 100%;
    background: #00b894;
    border-radius: 3px;
}

.goal-info small {
    font-size: 0.7rem;
    color: #888;
}

/* --- CARDS --- */
.card {
    background: white;
    border-radius: 20px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    margin-bottom: 20px;
    overflow: hidden;
}

.card-header {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
}

.icon-circle {
    background: #f0ebf8;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 12px;
    font-size: 1.2rem;
    margin-right: 15px;
}

.row-center {
    display: flex;
    align-items: center;
}

.col {
    display: flex;
    flex-direction: column;
}

.salary-value {
    font-weight: 700;
    font-size: 1.1rem;
    color: #820ad1;
    display: flex;
    align-items: center;
    gap: 5px;
}

.chevron {
    transition: transform 0.3s;
    font-size: 0.7rem;
}

.chevron.rotated {
    transform: rotate(180deg);
}

.card-body {
    padding: 0 20px 20px 20px;
    animation: fadeIn 0.3s ease;
}

/* --- FORMULÁRIOS MODERNOS --- */
.input-modern {
    width: 100%;
    padding: 12px 15px;
    border: 1px solid #eee;
    background: #f9f9f9;
    border-radius: 12px;
    font-size: 0.95rem;
    outline: none;
    transition: 0.3s;
}

.input-modern:focus {
    border-color: #820ad1;
    background: white;
}

.input-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
}

.full-width {
    grid-column: span 2;
}

.btn-launch {
    background: #820ad1;
    color: white;
    border: none;
    padding: 15px;
    border-radius: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: 0.2s;
}

.btn-launch:active {
    transform: scale(0.98);
}

/* --- LISTAS --- */
.tax-pills {
    display: flex;
    gap: 10px;
    margin: 10px 0;
}

.pill {
    padding: 5px 10px;
    border-radius: 20px;
    font-size: 0.75rem;
    font-weight: 600;
}

.pill.red {
    background: #ffe5e5;
    color: #d63031;
}

.add-row-modern {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
}

.add-row-modern input {
    flex: 1;
    padding: 10px;
    border-radius: 8px;
    border: 1px solid #eee;
}

.btn-circle {
    width: 40px;
    background: #333;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

.t-list {
    list-style: none;
    padding: 0;
}

.t-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    border-bottom: 1px solid #f5f5f5;
}

.t-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.cat-icon {
    width: 40px;
    height: 40px;
    background: #f4f6f8;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
}

.t-desc strong {
    display: block;
    font-size: 0.95rem;
    color: #333;
}

.t-desc small {
    color: #888;
    font-size: 0.8rem;
}

.t-right {
    text-align: right;
    display: flex;
    align-items: center;
    gap: 10px;
}

.val-green {
    color: #00b894;
    font-weight: 700;
}

.val-red {
    color: #ff7675;
    font-weight: 700;
}

.btn-trash {
    background: none;
    border: none;
    opacity: 0.3;
    cursor: pointer;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(-10px);
    }

    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
