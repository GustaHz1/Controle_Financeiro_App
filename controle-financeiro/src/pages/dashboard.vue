<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { auth, db } from '../firebase/index';
import { doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

const router = useRouter();
const carregando = ref(true);

// Estados
const filtroAtivo = ref('mes');
const isDarkTheme = ref(false);
const transacoes = ref([]);

// ==========================================
// BUSCA DE DADOS (FIREBASE) E TEMA
// ==========================================
const carregarDados = async (user) => {
    // Carrega o tema salvo localmente
    const temaSalvo = localStorage.getItem('theme_financas');
    if (temaSalvo) isDarkTheme.value = temaSalvo === 'dark';

    // Busca as transações com segurança
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            transacoes.value = docSnap.data().transacoes || [];
        }
    } catch (error) {
        console.error("Erro ao carregar dados do dashboard:", error);
    } finally {
        carregando.value = false;
    }
};

onMounted(() => {
    onAuthStateChanged(auth, (user) => {
        if (user) carregarDados(user);
        else router.push('/');
    });
});

const toggleTheme = () => {
    isDarkTheme.value = !isDarkTheme.value;
    localStorage.setItem('theme_financas', isDarkTheme.value ? 'dark' : 'light');
};

// ==========================================
// PROCESSAMENTO DE DADOS (LÓGICA DO GRÁFICO)
// ==========================================
const dadosFiltrados = computed(() => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth(); // 0 a 11

    let entradasTotal = 0;
    let saidasTotal = 0;
    let labels = [];
    let valoresAcumulados = [];
    let saldoAcumulado = 0;

    // Função auxiliar para processar valores de um dia/mês específico
    const processarPeriodo = (inicio, fim) => {
        const tPeriodo = transacoes.value.filter(t => {
            const dataT = new Date(t.data);
            return dataT >= inicio && dataT <= fim;
        });

        let entradasPeriodo = 0;
        let saidasPeriodo = 0;

        tPeriodo.forEach(t => {
            if (t.tipo === 'receita') entradasPeriodo += t.valor;
            if (t.tipo === 'despesa') saidasPeriodo += t.valor;
        });

        entradasTotal += entradasPeriodo;
        saidasTotal += saidasPeriodo;

        // Retorna o saldo líquido do período para ir somando no gráfico
        return entradasPeriodo - saidasPeriodo;
    };

    if (filtroAtivo.value === 'semana') {
        // Últimos 7 dias
        for (let i = 6; i >= 0; i--) {
            const dia = new Date(hoje);
            dia.setDate(hoje.getDate() - i);
            dia.setHours(0, 0, 0, 0);

            const fimDia = new Date(dia);
            fimDia.setHours(23, 59, 59, 999);

            labels.push(dia.toLocaleDateString('pt-BR', { weekday: 'short' }));
            saldoAcumulado += processarPeriodo(dia, fimDia);
            valoresAcumulados.push(saldoAcumulado);
        }
    }
    else if (filtroAtivo.value === 'mes') {
    const nomesMeses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

    // Percorre os 12 meses do ano (0 = Janeiro, 11 = Dezembro)
    for (let mes = 0; mes < 12; mes++) {
        const inicioMes = new Date(anoAtual, mes, 1, 0, 0, 0);
        const fimMes = new Date(anoAtual, mes + 1, 0, 23, 59, 59);

        labels.push(nomesMeses[mes]);
        saldoAcumulado += processarPeriodo(inicioMes, fimMes);
        valoresAcumulados.push(saldoAcumulado);
    }
}
    else if (filtroAtivo.value === 'ano') {
        // Meses do ano (Jan a Dez)
        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        for (let m = 0; m < 12; m++) {
            const inicioMes = new Date(anoAtual, m, 1, 0, 0, 0);
            const fimMes = new Date(anoAtual, m + 1, 0, 23, 59, 59);

            labels.push(mesesNomes[m]);
            saldoAcumulado += processarPeriodo(inicioMes, fimMes);
            valoresAcumulados.push(saldoAcumulado);
        }
    }

    return {
        grafico: { categories: labels, data: valoresAcumulados },
        resumo: { entradas: entradasTotal, saidas: saidasTotal, saldo: entradasTotal - saidasTotal }
    };
});

// ==========================================
// CONFIGURAÇÕES DO GRÁFICO (REATIVAS AO TEMA)
// ==========================================
const chartOptions = computed(() => {
    const corPrincipal = isDarkTheme.value ? '#00E5FF' : '#820ad1';
    const corTexto = isDarkTheme.value ? '#A0A0A0' : '#888888';
    const corGrid = isDarkTheme.value ? '#2C2C2C' : '#f1f1f1';

    return {
        chart: {
            id: 'financas-chart',
            toolbar: { show: false },
            fontFamily: 'Poppins, sans-serif',
            zoom: { enabled: false },
            background: 'transparent' 
        },
        colors: [corPrincipal],
        stroke: { curve: 'smooth', width: 3 },
        dataLabels: { enabled: false },
        xaxis: {
            categories: dadosFiltrados.value.grafico.categories,
            axisBorder: { show: false },
            axisTicks: { show: false },
            labels: { style: { colors: corTexto } }
        },
        yaxis: {
            labels: {
                style: { colors: corTexto },
                formatter: (value) => `R$ ${value.toFixed(0)}`
            }
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: isDarkTheme.value ? 0.4 : 0.7,
                opacityTo: 0.05,
                stops: [0, 90, 100]
            }
        },
        grid: {
            borderColor: corGrid,
            strokeDashArray: 4,
        },
        tooltip: {
            theme: isDarkTheme.value ? 'dark' : 'light',
            y: { formatter: (val) => `R$ ${val.toFixed(2)}` }
        }
    };
});

const series = computed(() => [{
    name: 'Evolução de Caixa',
    data: dadosFiltrados.value.grafico.data
}]);

const formatMoney = (val) => Number(val).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

</script>

<template>
    <div class="dashboard-container" :class="isDarkTheme ? 'dark-theme' : 'light-theme'">

        <div v-if="carregando" class="loading-screen">Carregando dados...</div>

        <template v-else>
            <header>
                <div class="header-left">
                    <button @click="router.push('/Home')" class="btn-back">← Voltar</button>
                    <h1>Análise de Evolução</h1>
                </div>
                <!-- Botão de Tema -->
                <button @click="toggleTheme" class="btn-icon">
                    {{ isDarkTheme ? '☀️' : '🌙' }}
                </button>
            </header>

            <div class="filtros">
                <button @click="filtroAtivo = 'semana'" :class="{ active: filtroAtivo === 'semana' }">Semana</button>
                <button @click="filtroAtivo = 'mes'" :class="{ active: filtroAtivo === 'mes' }">Mês</button>
                <button @click="filtroAtivo = 'ano'" :class="{ active: filtroAtivo === 'ano' }">Ano</button>
            </div>

            <div class="chart-card">
                <h3>Evolução do Saldo ({{ filtroAtivo.charAt(0).toUpperCase() + filtroAtivo.slice(1) }})</h3>
                <apexchart type="area" height="300" :options="chartOptions" :series="series"></apexchart>
            </div>

            <div class="resumo-grid">
                <div class="card-resumo entrada">
                    <span>Total de Entradas</span>
                    <strong>{{ formatMoney(dadosFiltrados.resumo.entradas) }}</strong>
                </div>
                <div class="card-resumo saida">
                    <span>Total de Saídas</span>
                    <strong>{{ formatMoney(dadosFiltrados.resumo.saidas) }}</strong>
                </div>
                <div class="card-resumo total">
                    <span>Saldo do Período</span>
                    <strong :class="{ 'negative-text': dadosFiltrados.resumo.saldo < 0 }">
                        {{ formatMoney(dadosFiltrados.resumo.saldo) }}
                    </strong>
                </div>
            </div>
        </template>
    </div>
</template>

<style scoped>
/* ==============================================================
   ARQUITETURA DE VARIÁVEIS CSS (CONTROLE DE TEMAS)
============================================================== */
.dashboard-container {
    --bg-color: #f8f9fa;
    --card-bg: #ffffff;
    --text-primary: #333333;
    --text-secondary: #555555;
    --border-color: #eeeeee;
    --accent-primary: #820ad1;
    --accent-secondary: #00b894;
    --danger-color: #d63031;
    --filter-bg: #e9ecef;
    --filter-text: #666666;
    --shadow-color: rgba(0, 0, 0, 0.05);

    background-color: var(--bg-color);
    min-height: 100vh;
    padding: 20px;
    font-family: 'Poppins', sans-serif;
    color: var(--text-primary);
    transition: all 0.3s ease;
}

.dashboard-container.dark-theme {
    --bg-color: #121212;
    --card-bg: #1E1E1E;
    --text-primary: #E0E0E0;
    --text-secondary: #A0A0A0;
    --border-color: #2C2C2C;
    --accent-primary: #00E5FF;
    --accent-secondary: #00E676;
    --danger-color: #FF4081;
    --filter-bg: #2C2C2C;
    --filter-text: #A0A0A0;
    --shadow-color: rgba(0, 0, 0, 0.3);
}

.loading-screen {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 100vh;
    font-size: 1.2rem;
    color: var(--accent-primary);
    font-weight: bold;
}

/* --- HEADER --- */
header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

header h1 {
    font-size: 1.2rem;
    color: var(--text-primary);
    margin: 0;
}

.btn-back {
    background: none;
    border: none;
    font-size: 1rem;
    color: var(--text-secondary);
    cursor: pointer;
    transition: 0.3s;
}

.btn-back:hover {
    color: var(--accent-primary);
}

.btn-icon {
    background: var(--card-bg);
    border: 1px solid var(--border-color);
    width: 40px;
    height: 40px;
    border-radius: 12px;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-primary);
    box-shadow: 0 2px 5px var(--shadow-color);
}

/* --- FILTROS --- */
.filtros {
    display: flex;
    justify-content: center;
    background: var(--filter-bg);
    padding: 5px;
    border-radius: 25px;
    margin-bottom: 25px;
    border: 1px solid var(--border-color);
}

.filtros button {
    flex: 1;
    border: none;
    background: transparent;
    padding: 10px 15px;
    border-radius: 20px;
    color: var(--filter-text);
    font-weight: 600;
    cursor: pointer;
    transition: 0.3s;
}

.filtros button.active {
    background: var(--card-bg);
    color: var(--accent-primary);
    box-shadow: 0 2px 5px var(--shadow-color);
}

/* --- GRÁFICO --- */
.chart-card {
    background: var(--card-bg);
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 4px 15px var(--shadow-color);
    margin-bottom: 20px;
    border: 1px solid var(--border-color);
}

.chart-card h3 {
    margin: 0 0 15px 0;
    font-size: 1rem;
    color: var(--text-secondary);
}

/* --- RESUMO --- */
.resumo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}

.card-resumo {
    background: var(--card-bg);
    padding: 15px;
    border-radius: 15px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 10px var(--shadow-color);
    border: 1px solid var(--border-color);
}

.card-resumo.total {
    grid-column: 1 / -1;
    background: var(--accent-primary);
    color: #fff;
    border: none;
}

.dark-theme .card-resumo.total {
    color: #121212;
}

.card-resumo span {
    font-size: 0.8rem;
    opacity: 0.8;
    margin-bottom: 5px;
    color: var(--text-secondary);
}

.card-resumo.total span {
    color: inherit;
    opacity: 0.9;
}

.card-resumo strong {
    font-size: 1.1rem;
    color: var(--text-primary);
}

.card-resumo.entrada strong {
    color: var(--accent-secondary);
}

.card-resumo.saida strong {
    color: var(--danger-color);
}

.card-resumo.total strong {
    font-size: 1.5rem;
    color: inherit;
}

.card-resumo.total strong.negative-text {
    color: #ffeaa7;
}

/* Amarelo alerta se no dark/purple e saldo negativo */
.dark-theme .card-resumo.total strong.negative-text {
    color: #d63031;
}
</style>