<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();

// Filtro selecionado
const filtroAtivo = ref('mes');

// Simula dados de saldo acumulado ao longo do tempo
const dadosGrafico = computed(() => {
    switch (filtroAtivo.value) {
        case 'semana':
            return {
                categories: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'],
                data: [150, 200, 180, 250, 300, 280, 400]
            };
        case 'mes':
            return {
                categories: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
                data: [1200, 950, 1500, 2100]
            };
        case 'ano':
            return {
                categories: ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
                data: [3000, 3200, 2800, 4500, 4700, 5200]
            };
        default:
            return { categories: [], data: [] };
    }
});

// Configurações do ApexCharts
const chartOptions = computed(() => ({
    chart: {
        id: 'financas-chart',
        toolbar: { show: false }, // Esconde menu de download
        fontFamily: 'Inter, sans-serif',
        zoom: { enabled: false }
    },
    colors: ['#820ad1'], // Roxo Nubank
    stroke: {
        curve: 'smooth', // Deixa a linha curva e suave
        width: 3
    },
    dataLabels: { enabled: false },
    xaxis: {
        categories: dadosGrafico.value.categories,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: '#888' } }
    },
    yaxis: {
        labels: {
            style: { colors: '#888' },
            formatter: (value) => `R$ ${value}`
        }
    },
    fill: {
        type: 'gradient',
        gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.7,
            opacityTo: 0.1,
            stops: [0, 90, 100]
        }
    },
    grid: {
        borderColor: '#f1f1f1',
        strokeDashArray: 4, // Linhas pontilhadas no fundo
    },
    tooltip: {
        theme: 'light',
        y: {
            formatter: (val) => `R$ ${val.toFixed(2)}`
        }
    }
}));

const series = computed(() => [{
    name: 'Saldo Acumulado',
    data: dadosGrafico.value.data
}]);

// Totais do Período (Fictício)
const resumo = computed(() => {
    if (filtroAtivo.value === 'semana') return { entradas: 800, saidas: 400, saldo: 400 };
    if (filtroAtivo.value === 'mes') return { entradas: 5000, saidas: 2900, saldo: 2100 };
    return { entradas: 35000, saidas: 29800, saldo: 5200 };
});

const formatMoney = (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

</script>

<template>
    <div class="dashboard-container">

        <header>
            <button @click="router.push('/Home')" class="btn-back">← Voltar</button>
            <h1>Análise de Evolução</h1>
        </header>

        <div class="filtros">
            <button @click="filtroAtivo = 'semana'" :class="{ active: filtroAtivo === 'semana' }">Semana</button>
            <button @click="filtroAtivo = 'mes'" :class="{ active: filtroAtivo === 'mes' }">Mês</button>
            <button @click="filtroAtivo = 'ano'" :class="{ active: filtroAtivo === 'ano' }">Ano</button>
        </div>

        <div class="chart-card">
            <h3>Evolução do Saldo</h3>
            <apexchart type="area" height="300" :options="chartOptions" :series="series"></apexchart>
        </div>

        <div class="resumo-grid">
            <div class="card-resumo entrada">
                <span>Entradas</span>
                <strong>{{ formatMoney(resumo.entradas) }}</strong>
            </div>
            <div class="card-resumo saida">
                <span>Saídas</span>
                <strong>{{ formatMoney(resumo.saidas) }}</strong>
            </div>
            <div class="card-resumo total">
                <span>Saldo Período</span>
                <strong>{{ formatMoney(resumo.saldo) }}</strong>
            </div>
        </div>

    </div>
</template>

<style scoped>
.dashboard-container {
    min-height: 100vh;
    background-color: #f8f9fa;
    padding: 20px;
    font-family: 'Inter', sans-serif;
}

header {
    display: flex;
    align-items: center;
    gap: 15px;
    margin-bottom: 20px;
}

header h1 {
    font-size: 1.2rem;
    color: #333;
    margin: 0;
}

.btn-back {
    background: none;
    border: none;
    font-size: 1rem;
    color: #666;
    cursor: pointer;
}

/* Filtros (Pílulas) */
.filtros {
    display: flex;
    justify-content: center;
    background: #e9ecef;
    padding: 5px;
    border-radius: 25px;
    margin-bottom: 25px;
}

.filtros button {
    flex: 1;
    border: none;
    background: transparent;
    padding: 8px 15px;
    border-radius: 20px;
    color: #666;
    font-weight: 600;
    cursor: pointer;
    transition: 0.3s;
}

.filtros button.active {
    background: white;
    color: #820ad1;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

/* Cartão do Gráfico */
.chart-card {
    background: white;
    border-radius: 20px;
    padding: 20px;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05);
    margin-bottom: 20px;
}

.chart-card h3 {
    margin: 0 0 15px 0;
    font-size: 1rem;
    color: #555;
}

/* Cards de Resumo */
.resumo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
}

.card-resumo {
    background: white;
    padding: 15px;
    border-radius: 15px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
}

.card-resumo.total {
    grid-column: 1 / -1;
    background: #820ad1;
    color: white;
}

.card-resumo span {
    font-size: 0.8rem;
    opacity: 0.8;
    margin-bottom: 5px;
}

.card-resumo strong {
    font-size: 1.1rem;
}

.card-resumo.entrada strong {
    color: #00b894;
}

.card-resumo.saida strong {
    color: #d63031;
}

.card-resumo.total strong {
    color: white;
    font-size: 1.5rem;
}
</style>