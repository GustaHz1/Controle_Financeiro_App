import { createRouter, createWebHistory } from 'vue-router';
import { getAuth, onAuthStateChanged } from "firebase/auth";
import homePage from '../pages/homePage.vue';
import loginPage from '../pages/loginPage.vue';
import dashboardPage from '../pages/dashboard.vue';

const routes = [
    {
        path: '/Home',
        name: 'Home',
        component: homePage,
        meta: { requiresAuth: true }
    },
    {
        path: '/',
        name: 'Login',
        component: loginPage
    },
    {
        path: '/dashboard',
        name: 'Dashboard',
        component: dashboardPage,
        meta: { requiresAuth: true }
    },
];

const router = createRouter({
    history: createWebHistory(),
    routes
});

// Lógica de proteção de rota
// (Verifica antes de cada navegação se o usuário tem permissão)
const getCurrentUser = () => {
    return new Promise((resolve, reject) => {
        const removeListener = onAuthStateChanged(
            getAuth(),
            (user) => {
                removeListener();
                resolve(user);
            },
            reject
        );
    });
};

router.beforeEach(async (to, from, next) => {
    if (to.matched.some((record) => record.meta.requiresAuth)) {
        if (await getCurrentUser()) {
            next();
        } else {
            alert("Você precisa fazer login para acessar essa página!");
            next("/"); // Manda de volta pro login
        }
    } else {
        next();
    }
});

export default router;