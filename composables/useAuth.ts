// composables/useAuth.ts
interface User {
    id: number;
    email: string;
    role: string;
}

export function useAuth() {
    const token = useCookie("dmqt_token", {
        maxAge: 60 * 60 * 24 * 7,
    });
    const user = useState<User | null>("auth_user", () => null);

    const isLoggedIn = computed(() => !!token.value);

    async function login(email: string, password: string) {
        const res = await $fetch<{ token: string; user: User }>(
            "/api/auth/login",
            {
                method: "POST",
                body: { email, password },
            },
        );
        token.value = res.token;
        user.value = res.user;
        return res;
    }

    async function register(email: string, password: string) {
        const res = await $fetch<{ token: string; user: User }>(
            "/api/auth/register",
            {
                method: "POST",
                body: { email, password },
            },
        );
        token.value = res.token;
        user.value = res.user;
        return res;
    }

    async function fetchMe() {
        if (!token.value) return null;
        try {
            const me = await $fetch<User>("/api/auth/me", {
                headers: { Authorization: `Bearer ${token.value}` },
            });
            user.value = me;
            return me;
        } catch {
            token.value = null;
            user.value = null;
            return null;
        }
    }

    function logout() {
        token.value = null;
        user.value = null;
    }

    return { token, user, isLoggedIn, login, register, fetchMe, logout };
}