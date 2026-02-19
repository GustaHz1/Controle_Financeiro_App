import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// 1. Importar o ApexCharts
import VueApexCharts from "vue3-apexcharts";

const app = createApp(App)

app.use(router)

// 2. Usar o ApexCharts
app.use(VueApexCharts);

app.mount('#app')