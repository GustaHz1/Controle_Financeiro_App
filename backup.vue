<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth, db } from '../firebase/index';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const router = useRouter();

// ==========================================
// CLASSES POO (MODELOS DE DADOS)
// ==========================================
class Transacao {
    constructor(nome, valor, tipo, categoria) {
        this.id = Date.now() + Math.random(); // Evita colisão de IDs rápidos
        this.nome = nome;
        this.valor = parseFloat(valor);
        this.tipo = tipo;
        this.categoria = categoria;
        this.data = new Date().toISOString();
    }
}

class Meta {
    constructor(nome, alvo, icon = '🎯') {
        this.id = Date.now();
        this.nome = nome;
        this.alvo = parseFloat(alvo);
        this.atual = 0;
        this.icon = icon;
    }
}

class DescontoExtra {
    constructor(nome, valor) {
        this.id = Date.now();
        this.nome = nome;
        this.valor = parseFloat(valor);
    }
}

// ==========================================
// ESTADOS DA APLICAÇÃO
// ==========================================
const isDarkTheme = ref(false);

const userName = ref('Usuário');
const userPhoto = ref('');
const fileInput = ref(null);

const salarioBruto = ref(0);
const valePorcentagem = ref(0); // Novo estado para o Vale
const mostrarDetalhesSalario = ref(false);
const carregando = ref(true);
const mostrarModalConquistas = ref(false);
const notificacaoAtiva = ref(null);

const descontosExtras = ref([]);
const transacoes = ref([]);
const metas = ref([]);
const insigniasDesbloqueadas = ref([]);

const novaTransacaoNome = ref('');
const novaTransacaoValor = ref('');
const tipoTransacao = ref('despesa');
const categoriaTransacao = ref('Outros');

const novaMetaNome = ref('');
const novaMetaValor = ref('');

const categorias = { 'Comida': '🍔', 'Transporte': '🚗', 'Lazer': '🎮', 'Contas': '💡', 'Saúde': '💊', 'Outros': '📦' };

// ==========================================
// GAMIFICAÇÃO
// ==========================================
const todasInsignias = [
    { id: 'primeiro_passo', nome: 'Primeiro Passo', desc: 'Fez o primeiro registro.', icon: '🚀' },
    { id: 'poupador_iniciante', nome: 'Poupador Jr.', desc: 'Terminou o mês positivo.', icon: '🐷' },
    { id: 'milionario', nome: 'Barão', desc: 'Acumulou mais de R$ 5.000.', icon: '🎩' },
    { id: 'controlado', nome: 'Na Rédea', desc: 'Registrou mais de 5 despesas.', icon: '📝' },
    { id: 'investidor', nome: 'Foco na Meta', desc: 'Criou sua primeira meta.', icon: '🎯' },
    { id: 'mono_jhin', nome: 'Mono Jhin', desc: 'Lançou exatamente 4444. QUATRO!', icon: '🎭' },
    { id: 'hacker_elite', nome: 'Leet', desc: 'Lançou exatamente 1337.', icon: '💻' },
    { id: 'besta', nome: 'A Besta', desc: 'Lançou exatamente 666.', icon: '😈' },
    { id: 'centuriao', nome: 'Centurião', desc: 'Atingiu 100 transações.', icon: '⚔️' },
    { id: 'magnata', nome: 'Magnata', desc: 'Acumulou R$ 50.000 em saldo.', icon: '👑' },
    { id: 'gastador', nome: 'Mão Aberta', desc: 'Gastou mais de R$ 10.000 de uma vez.', icon: '💸' },
    { id: 'fast_food', nome: 'Rei do Lanche', desc: '5 despesas com Comida.', icon: '🍔' },
    { id: 'gamer', nome: 'Tryhard', desc: '5 despesas com Lazer.', icon: '🕹️' },
    { id: 'saudavel', nome: 'Fitness', desc: 'Criou 3 despesas de Saúde.', icon: '💪' },
    { id: 'ostentacao', nome: 'Camarote', desc: 'Uma despesa > R$ 1.000.', icon: '🍾' },
    { id: 'sortudo', nome: 'Trevo', desc: 'Primeira receita extra registrada.', icon: '🍀' },
    { id: 'noturno', nome: 'Coruja', desc: 'Registrou de madrugada (00h as 05h).', icon: '🦉' },
    { id: 'fundo_poco', nome: 'Bateu na Trave', desc: 'Saldo negativo.', icon: '📉' },
    { id: 'perfeccionista', nome: 'TOC', desc: 'Lançou um valor exato e redondo.', icon: '📏' },
    { id: 'zen', nome: 'Equilíbrio', desc: 'Bateu 5 metas concluídas.', icon: '🧘‍♂️' }
];

const mostrarNotificacao = (titulo, msg, tipo = 'sucesso') => {
    notificacaoAtiva.value = { titulo, msg, tipo };
    setTimeout(() => { notificacaoAtiva.value = null; }, 4000);
};

// ==========================================
// TEMA & PERFIL LOCAL
// ==========================================
const toggleTheme = () => {
    isDarkTheme.value = !isDarkTheme.value;
    localStorage.setItem('theme_financas', isDarkTheme.value ? 'dark' : 'light');
};

const acionarInputFoto = () => { if (fileInput.value) fileInput.value.click(); };

const aoTrocarFoto = (event) => {
    const file = event.target.files[0];
    if (file) {
        if (file.size > 2000000) { return mostrarNotificacao('Erro', 'Máximo 2MB.', 'erro'); }
        const reader = new FileReader();
        reader.onload = (e) => {
            userPhoto.value = e.target.result;
            localStorage.setItem('userPhoto_financas', e.target.result);
        };
        reader.readAsDataURL(file);
    }
};

// ==========================================
// CÁLCULOS DO SALÁRIO (Com Vale e Regras Novas)
// ==========================================

// 1. Vale (Livre de impostos)
const valorVale = computed(() => (salarioBruto.value * (valePorcentagem.value / 100)));

// 2. Base Tributável (O que sobrou do Bruto para tributar)
const baseTributavel = computed(() => salarioBruto.value - valorVale.value);

// 3. INSS
const inss = computed(() => {
    const s = baseTributavel.value;
    if (!s) return 0;
    if (s <= 1412) return s * 0.075;
    if (s <= 2666.68) return (1412 * 0.075) + ((s - 1412) * 0.09);
    if (s <= 4000.03) return 105.9 + 112.92 + ((s - 2666.68) * 0.12);
    if (s <= 7786.02) return 105.9 + 112.92 + 160.0 + ((s - 4000.03) * 0.14);
    return 908.85;
});

// 4. IRRF (Nova Regra: Apenas se Base for > 5000)
const irrf = computed(() => {
    const b = baseTributavel.value - inss.value;
    if (b <= 5000) return 0;
    return (b * 0.275) - 869.36; // Aplica o teto acima de 5000
});

const totalDescontosExtras = computed(() => descontosExtras.value.reduce((a, c) => a + c.valor, 0));

// 5. Salário Restante Após Impostos
const salarioLiquidoRestante = computed(() => Math.max(0, baseTributavel.value - inss.value - irrf.value - totalDescontosExtras.value));

// 6. Total Líquido a Receber (Vale + Restante)
const salarioLiquidoTotal = computed(() => valorVale.value + salarioLiquidoRestante.value);


// ==========================================
// SALDOS GERAIS (Totalmente Baseado em Transações)
// ==========================================
const totalGastos = computed(() => transacoes.value.filter(t => t.tipo === 'despesa').reduce((a, c) => a + c.valor, 0));
const totalRendas = computed(() => transacoes.value.filter(t => t.tipo === 'receita').reduce((a, c) => a + c.valor, 0));

// O Saldo agora é a soma de TUDO o que foi lançado, evitando duplicação.
const saldoFinal = computed(() => totalRendas.value - totalGastos.value);
const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ==========================================
// FIREBASE
// ==========================================
const salvarNoFirebase = async () => {
    if (!auth.currentUser) return;
    try {
        const transacoesLimpas = transacoes.value.map(t => ({ ...t }));
        const metasLimpas = metas.value.map(m => ({ ...m }));

        await setDoc(doc(db, "users", auth.currentUser.uid), {
            salarioBruto: salarioBruto.value,
            valePorcentagem: valePorcentagem.value,
            transacoes: transacoesLimpas,
            metas: metasLimpas,
            insignias: insigniasDesbloqueadas.value
        }, { merge: true });
    } catch (error) {
        console.error("Erro ao salvar: ", error);
    }
};

const carregarDados = async (user) => {
    userName.value = user.displayName || 'Usuário';

    const fotoSalva = localStorage.getItem('userPhoto_financas');
    userPhoto.value = fotoSalva || user.photoURL || 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

    const temaSalvo = localStorage.getItem('theme_financas');
    if (temaSalvo) { isDarkTheme.value = temaSalvo === 'dark'; }

    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
        const dados = docSnap.data();
        salarioBruto.value = dados.salarioBruto || 0;
        valePorcentagem.value = dados.valePorcentagem || 0;
        transacoes.value = dados.transacoes || [];
        metas.value = dados.metas || [];
        insigniasDesbloqueadas.value = dados.insignias || [];
    }
    carregando.value = false;
};

// ==========================================
// AÇÕES & CRUD
// ==========================================

const verificarConquistas = (novaTransacao) => {
    const novas = [];
    const tValor = novaTransacao ? novaTransacao.valor : 0;
    const addBadge = (id) => { if (!insigniasDesbloqueadas.value.includes(id)) novas.push(id); }

    if (transacoes.value.length > 0) addBadge('primeiro_passo');
    if (saldoFinal.value >= 5000) addBadge('milionario');
    if (tValor === 4444) addBadge('mono_jhin');
    if (tValor === 666) addBadge('besta');
    if (tValor > 1000 && novaTransacao?.tipo === 'despesa') addBadge('ostentacao');

    if (novas.length > 0) {
        insigniasDesbloqueadas.value = [...insigniasDesbloqueadas.value, ...novas];
        mostrarNotificacao('🏆 Conquista!', todasInsignias.find(b => b.id === novas[0]).nome, 'conquista');
        salvarNoFirebase();
    }
};

const addTransacao = () => {
    if (!novaTransacaoNome.value || !novaTransacaoValor.value) return;
    const transacaoObj = new Transacao(novaTransacaoNome.value, novaTransacaoValor.value, tipoTransacao.value, categoriaTransacao.value);
    transacoes.value.unshift(transacaoObj);

    if (metas.value.length > 0 && transacaoObj.tipo === 'receita') { metas.value[0].atual += transacaoObj.valor; }
    novaTransacaoNome.value = ''; novaTransacaoValor.value = '';

    verificarConquistas(transacaoObj);
    salvarNoFirebase();
    mostrarNotificacao('Sucesso', 'Movimentação registrada!', 'padrao');
};

const removeTransacao = (id) => { transacoes.value = transacoes.value.filter(t => t.id !== id); salvarNoFirebase(); };

// FUNÇÃO NOVA: Contabilizar o salário no mês (+)
const lancarSalarioMensal = () => {
    if (salarioBruto.value <= 0) return mostrarNotificacao('Erro', 'Insira um salário bruto.', 'erro');

    // 1. Lança o Vale (Se houver)
    if (valorVale.value > 0) {
        transacoes.value.unshift(new Transacao(`Adiantamento Vale (${valePorcentagem.value}%)`, valorVale.value, 'receita', 'Outros'));
    }

    // 2. Lança o Salário Restante
    if (salarioLiquidoRestante.value > 0) {
        transacoes.value.unshift(new Transacao('Pagamento Salário', salarioLiquidoRestante.value, 'receita', 'Outros'));
    }

    if (metas.value.length > 0) { metas.value[0].atual += salarioLiquidoTotal.value; }

    verificarConquistas({ valor: salarioLiquidoTotal.value });
    salvarNoFirebase();
    mostrarNotificacao('Sucesso', 'Salário lançado na conta!', 'conquista');
};

const addMeta = () => {
    if (!novaMetaNome.value || !novaMetaValor.value) return;
    metas.value.push(new Meta(novaMetaNome.value, novaMetaValor.value));
    novaMetaNome.value = ''; novaMetaValor.value = '';
    salvarNoFirebase();
};

const atualizarMetaProgressiva = (meta) => {
    const novoValorStr = prompt(`Parabéns! Você bateu a meta de ${formatMoney(meta.alvo)}. Defina a próxima:`);
    const novoValor = parseFloat(novoValorStr);
    if (novoValor > 0) {
        meta.alvo = novoValor;
        meta.atual = 0;
        salvarNoFirebase();
    }
};

const atualizarSalario = () => { salvarNoFirebase(); };

onMounted(() => {
    onAuthStateChanged(auth, (user) => {
        if (user) carregarDados(user);
        else router.push('/');
    });
});
</script>

<template>
    <div class="app-container" :class="isDarkTheme ? 'dark-theme' : 'light-theme'">

        <input type="file" ref="fileInput" @change="aoTrocarFoto" accept="image/*" style="display: none;" />
<header class="header-modern">
            <div class="user-profile">
                <div class="avatar-container" @click="acionarInputFoto" title="Trocar foto">
                    <img :src="userPhoto" alt="Perfil" class="avatar" />
                    <div class="avatar-edit-icon">✏️</div>
                </div>

                <div class="user-info">
                    <span class="greeting">Olá, {{ userName.split(' ')[0] }}!</span>
                    <div class="badges-mini" @click="mostrarModalConquistas = true">
                        <span v-for="bId in insigniasDesbloqueadas.slice(0, 3)" :key="bId">
                            {{todasInsignias.find(i => i.id === bId)?.icon}}
                        </span>
                        <span class="plus-badge" v-if="insigniasDesbloqueadas.length === 0">🏆 Ver Conquistas</span>
                    </div>
                </div>
                
                <!-- GRUPO DE BOTÕES (Ações do Cabeçalho) -->
                <div class="header-actions">
                    <!-- 1. Botão Toggle Tema -->
                    <button @click="toggleTheme" class="btn-icon" title="Alterar Tema">
                        {{ isDarkTheme ? '☀️' : '🌙' }}
                    </button>
                    
                    <!-- 2. NOVO BOTÃO: Dashboard -->
                    <button @click="router.push('/dashboard')" class="btn-icon" title="Análise de Evolução">
                        📊
                    </button>

                    <!-- 3. Botão Troféus -->
                    <button @click="mostrarModalConquistas = true" class="btn-icon relative" title="Sala de Troféus">
                        🏆<span class="badge-count" v-if="insigniasDesbloqueadas.length > 0">{{ insigniasDesbloqueadas.length }}</span>
                    </button>
                </div>
            </div>

            <div class="balance-big">
                <span class="label">Saldo em Conta</span>
                <h1 :class="{ 'negative': saldoFinal < 0 }">{{ formatMoney(saldoFinal) }}</h1>
            </div>
        </header>

        <main class="content-scroll">

            <div class="section-title">🎯 Minhas Metas (Progresso)</div>
            <div class="goals-carousel">
                <div class="goal-card" v-for="meta in metas" :key="meta.id">
                    <div class="goal-icon">{{ meta.icon }}</div>
                    <div class="goal-info">
                        <span>{{ meta.nome }}</span>
                        <div class="progress-bar">
                            <div class="fill" :style="{ width: Math.min((meta.atual / meta.alvo * 100), 100) + '%' }">
                            </div>
                        </div>
                        <small>{{ formatMoney(meta.atual) }} / {{ formatMoney(meta.alvo) }}</small>
                        <button v-if="meta.atual >= meta.alvo" @click="atualizarMetaProgressiva(meta)"
                            class="btn-upgrade-goal">
                            Subir de Nível ⬆️
                        </button>
                    </div>
                </div>

                <div class="goal-card add-goal-card" v-if="metas.length < 3">
                    <input type="text" v-model="novaMetaNome" placeholder="Nome Meta" class="input-modern mini" />
                    <input type="number" v-model="novaMetaValor" placeholder="Alvo R$" class="input-modern mini" />
                    <button @click="addMeta" class="btn-primary mini-btn">+ Criar</button>
                </div>
            </div>

            <!-- CALCULADORA DE SALÁRIO E VALE -->
            <section class="card salary-card">
                <div class="card-header" @click="mostrarDetalhesSalario = !mostrarDetalhesSalario">
                    <div class="row-center">
                        <span class="icon-circle">💼</span>
                        <div class="col">
                            <h3>Calculadora de Salário</h3>
                            <small class="text-muted">{{ mostrarDetalhesSalario ? 'Fechar' : 'Abrir para calcular e lançar' }}</small>
                        </div>
                    </div>
                    <div class="salary-value">{{ formatMoney(salarioLiquidoTotal) }}</div>
                </div>

                <div v-if="mostrarDetalhesSalario" class="card-body fade-in">
                    <div class="input-grid" style="margin-bottom: 15px;">
                        <div>
                            <label class="label-input">Salário Bruto (R$)</label>
                            <input type="number" v-model="salarioBruto" @change="atualizarSalario"
                                class="input-modern" />
                        </div>
                        <div>
                            <label class="label-input">Vale (0 a 100%)</label>
                            <input type="number" v-model="valePorcentagem" max="100" min="0" @change="atualizarSalario"
                                class="input-modern" />
                        </div>
                    </div>

                    <div class="salary-resume">
                        <div class="resume-row"><small>Vale (Livre):</small> <strong>{{ formatMoney(valorVale)
                                }}</strong></div>
                        <div class="resume-row"><small>Base Tributável:</small> <strong>{{ formatMoney(baseTributavel)
                                }}</strong></div>
                        <div class="resume-row red"><small>INSS:</small> <strong>- {{ formatMoney(inss) }}</strong>
                        </div>
                        <div class="resume-row red"><small>IRRF (> 5000):</small> <strong>- {{ formatMoney(irrf)
                                }}</strong></div>
                    </div>

                    <button @click="lancarSalarioMensal" class="btn-launch full-width" style="margin-top: 15px;">
                        + Lançar Salário no Saldo
                    </button>
                </div>
            </section>

            <!-- NOVO LANÇAMENTO (GASTOS E RENDAS EXTRAS) -->
            <section class="card transaction-card">
                <h3>📝 Novo Lançamento Extra</h3>
                <div class="input-grid">
                    <select v-model="tipoTransacao" class="input-modern">
                        <option value="despesa">💸 Gasto</option>
                        <option value="receita">💰 Receita Extra</option>
                    </select>
                    <select v-model="categoriaTransacao" class="input-modern">
                        <option v-for="(icon, name) in categorias" :value="name" :key="name">{{ icon }} {{ name }}
                        </option>
                    </select>
                    <input type="text" v-model="novaTransacaoNome" placeholder="Descrição"
                        class="input-modern full-width" />
                    <input type="number" v-model="novaTransacaoValor" placeholder="Valor (ex: 4444)"
                        class="input-modern full-width" />
                    <button @click="addTransacao" class="btn-launch full-width">Lançar Transação</button>
                </div>
            </section>

            <div class="transactions-area">
                <h3 class="section-title">Histórico Recente</h3>
                <ul class="t-list">
                    <li v-for="t in transacoes" :key="t.id" class="t-item">
                        <div class="t-left">
                            <div class="cat-icon">{{ categorias[t.categoria] || '📦' }}</div>
                            <div class="t-desc">
                                <strong>{{ t.nome }}</strong>
                                <small>{{ new Date(t.data).toLocaleDateString('pt-BR') }}</small>
                            </div>
                        </div>
                        <div class="t-right">
                            <span :class="t.tipo === 'receita' ? 'val-green' : 'val-red'">
                                {{ t.tipo === 'despesa' ? '-' : '+' }} {{ formatMoney(t.valor) }}
                            </span>
                            <button @click="removeTransacao(t.id)" class="btn-trash">🗑️</button>
                        </div>
                    </li>
                </ul>
            </div>
        </main>

        <!-- MODAL CONQUISTAS -->
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
/* TODO O CSS IDÊNTICO AO CÓDIGO ANTERIOR COM VARIÁVEIS DE TEMA */
.app-container {
    --bg-color: #f8f9fa;
    --header-bg: #820ad1;
    --header-text: #ffffff;
    --card-bg: #ffffff;
    --text-primary: #333333;
    --text-secondary: #555555;
    --text-muted: #888888;
    --border-color: #eeeeee;
    --accent-primary: #820ad1;
    --accent-secondary: #00b894;
    --btn-launch-text: #ffffff;
    --input-bg: #f9f9f9;
    --icon-bg: #f0ebf8;
    --danger-color: #ff7675;
    --shadow-color: rgba(0, 0, 0, 0.05);

    background-color: var(--bg-color);
    min-height: 100vh;
    font-family: 'Poppins', sans-serif;
    color: var(--text-primary);
    transition: background-color 0.3s ease, color 0.3s ease;
}

.app-container.dark-theme {
    --bg-color: #121212;
    --header-bg: #1E1E1E;
    --header-text: #ffffff;
    --card-bg: #1E1E1E;
    --text-primary: #E0E0E0;
    --text-secondary: #A0A0A0;
    --text-muted: #888888;
    --border-color: #2C2C2C;
    --accent-primary: #00E5FF;
    --accent-secondary: #00E676;
    --btn-launch-text: #121212;
    --input-bg: #121212;
    --icon-bg: rgba(0, 229, 255, 0.1);
    --danger-color: #FF4081;
    --shadow-color: rgba(0, 0, 0, 0.3);
}

.header-modern {
    background: var(--header-bg);
    color: var(--header-text);
    padding: 20px 20px 30px 20px;
    border-bottom-left-radius: 30px;
    border-bottom-right-radius: 30px;
    box-shadow: 0 10px 30px var(--shadow-color);
    position: relative;
    z-index: 10;
    transition: background-color 0.3s ease;
}

.dark-theme .header-modern {
    border-bottom: 2px solid var(--accent-primary);
}

.user-profile {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 25px;
}

.avatar-container {
    position: relative;
    cursor: pointer;
}

.avatar {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    border: 2px solid var(--accent-primary);
    object-fit: cover;
    background-color: var(--card-bg);
}

.avatar-edit-icon {
    position: absolute;
    bottom: -5px;
    right: -5px;
    font-size: 0.8rem;
    background: var(--header-bg);
    border-radius: 50%;
    padding: 2px;
}

.user-info {
    flex: 1;
}

.greeting {
    display: block;
    font-weight: 600;
    font-size: 1.1rem;
    color: var(--header-text);
}

.header-actions {
    display: flex;
    gap: 10px;
}

.btn-icon {
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    width: 40px;
    height: 40px;
    border-radius: 12px;
    font-size: 1.2rem;
    cursor: pointer;
    color: white;
    transition: 0.2s;
}

.dark-theme .btn-icon {
    border: 1px solid rgba(0, 229, 255, 0.2);
}

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
    color: var(--header-text);
    padding: 2px 8px;
    border-radius: 10px;
}

.dark-theme .plus-badge {
    background: rgba(0, 229, 255, 0.1);
    color: var(--accent-primary);
}

.badge-count {
    position: absolute;
    top: -5px;
    right: -5px;
    background: var(--danger-color);
    color: white;
    font-size: 0.7rem;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--header-bg);
}

.balance-big {
    text-align: center;
}

.balance-big .label {
    font-size: 0.9rem;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--header-text);
}

.dark-theme .balance-big .label {
    color: var(--accent-primary);
}

.balance-big h1 {
    font-size: 2.5rem;
    margin: 5px 0;
    font-weight: 700;
    color: var(--header-text);
}

.balance-big h1.negative {
    color: var(--danger-color);
}

.content-scroll {
    padding: 20px 20px 80px 20px;
    z-index: 5;
}

.section-title {
    font-weight: 600;
    margin: 20px 0 10px 0;
    color: var(--text-secondary);
    font-size: 0.95rem;
}

.goals-carousel {
    display: flex;
    gap: 15px;
    overflow-x: auto;
    padding-bottom: 10px;
    scrollbar-width: none;
}

.goals-carousel::-webkit-scrollbar {
    display: none;
}

.goal-card {
    background: var(--card-bg);
    min-width: 160px;
    padding: 15px;
    border-radius: 16px;
    box-shadow: 0 4px 10px var(--shadow-color);
    border: 1px solid var(--border-color);
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: 0.3s;
}

.add-goal-card {
    display: flex;
    gap: 5px;
    justify-content: space-between;
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
    color: var(--text-primary);
}

.progress-bar {
    height: 6px;
    background: var(--border-color);
    border-radius: 3px;
    margin-bottom: 5px;
    overflow: hidden;
}

.fill {
    height: 100%;
    background: var(--accent-secondary);
    border-radius: 3px;
    transition: width 0.4s ease;
}

.goal-info small {
    font-size: 0.7rem;
    color: var(--text-muted);
}

.btn-upgrade-goal {
    margin-top: 8px;
    background: var(--accent-primary);
    color: var(--btn-launch-text);
    border: none;
    padding: 5px;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: bold;
    cursor: pointer;
}

.card {
    background: var(--card-bg);
    border-radius: 20px;
    box-shadow: 0 4px 15px var(--shadow-color);
    border: 1px solid var(--border-color);
    margin-bottom: 20px;
    overflow: hidden;
    transition: 0.3s;
}

.card-header {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
}

.icon-circle {
    background: var(--icon-bg);
    color: var(--accent-primary);
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

.col h3 {
    color: var(--text-primary);
    font-size: 1.1rem;
    margin: 0;
}

.text-muted {
    color: var(--text-muted);
}

.salary-value {
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--accent-primary);
}

.card-body {
    padding: 0 20px 20px 20px;
    animation: fadeIn 0.3s ease;
}

.salary-resume {
    background: var(--input-bg);
    border: 1px solid var(--border-color);
    border-radius: 12px;
    padding: 10px 15px;
    margin-bottom: 10px;
}

.resume-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 5px;
    font-size: 0.85rem;
}

.resume-row.red strong {
    color: var(--danger-color);
}

.label-input {
    display: block;
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 5px;
}

.input-modern {
    width: 100%;
    padding: 12px 15px;
    border: 1px solid var(--border-color);
    background: var(--input-bg);
    color: var(--text-primary);
    border-radius: 12px;
    font-size: 0.95rem;
    outline: none;
    transition: 0.3s;
    box-sizing: border-box;
}

.input-modern:focus {
    border-color: var(--accent-primary);
}

.input-modern.mini {
    padding: 8px;
    font-size: 0.8rem;
    margin-bottom: 5px;
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
    background: var(--accent-primary);
    color: var(--btn-launch-text);
    border: none;
    padding: 15px;
    border-radius: 12px;
    font-weight: bold;
    font-size: 1rem;
    cursor: pointer;
    transition: 0.2s;
}

.btn-launch:active {
    transform: scale(0.98);
}

.btn-primary.mini-btn {
    background: var(--accent-secondary);
    border: none;
    color: #121212;
    border-radius: 8px;
    font-weight: bold;
    cursor: pointer;
    padding: 5px;
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
    border-bottom: 1px solid var(--border-color);
}

.t-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.cat-icon {
    width: 40px;
    height: 40px;
    background: var(--icon-bg);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.2rem;
}

.t-desc strong {
    display: block;
    font-size: 0.95rem;
    color: var(--text-primary);
}

.t-desc small {
    color: var(--text-muted);
    font-size: 0.75rem;
}

.t-right {
    text-align: right;
    display: flex;
    align-items: center;
    gap: 10px;
}

.val-green {
    color: var(--accent-secondary);
    font-weight: 700;
}

.val-red {
    color: var(--danger-color);
    font-weight: 700;
}

.btn-trash {
    background: none;
    border: none;
    font-size: 1.1rem;
    opacity: 0.5;
    cursor: pointer;
    transition: 0.3s;
}

.btn-trash:hover {
    opacity: 1;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(5px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
}

.modal-content {
    background: var(--card-bg);
    width: 90%;
    max-width: 400px;
    border-radius: 20px;
    padding: 20px;
    animation: popUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    max-height: 80vh;
    overflow-y: auto;
    color: var(--text-primary);
    border: 1px solid var(--border-color);
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
    color: var(--text-primary);
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
    background: var(--bg-color);
    border: 1px solid var(--border-color);
}

.badge-item.locked {
    opacity: 0.4;
    filter: grayscale(1);
}

.badge-icon {
    font-size: 2rem;
}

.badge-text strong {
    display: block;
    font-size: 0.95rem;
    color: var(--accent-primary);
}

.badge-text p {
    font-size: 0.8rem;
    color: var(--text-secondary);
    margin: 0;
}

.toast-notification {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--border-color);
    color: var(--text-primary);
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
    background: linear-gradient(135deg, var(--card-bg), var(--bg-color));
    border: 1px solid var(--accent-primary);
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