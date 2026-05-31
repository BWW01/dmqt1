// composables/useAuth.ts
interface User {
    id: number;
    email: string;
    role: string;
    credits: number;
}

interface AuthResponse {
    token: string;
    user: User;
}

export function useAuth() {
    const token = useCookie<string | null>("dmqt_token", {
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
    });

    const user = useState<User | null>("auth_user", () => null);
    const isInitialized = useState<boolean>("auth_initialized", () => false);

    const isLoggedIn = computed(() => !!token.value && !!user.value);

    function setAuth(res: AuthResponse) {
        token.value = res.token;
        user.value = res.user;
    }

    function clearAuth() {
        token.value = null;
        user.value = null;
    }

    async function login(email: string, password: string) {
        try {
            const res = await $fetch<AuthResponse>("/api/auth/login", {
                method: "POST",
                body: { email, password },
            });
            setAuth(res);
            return res;
        } catch (error) {
            clearAuth();
            throw error;
        }
    }

    async function register(email: string, password: string) {
        try {
            const res = await $fetch<AuthResponse>("/api/auth/register", {
                method: "POST",
                body: { email, password },
            });
            setAuth(res);
            return res;
        } catch (error) {
            clearAuth();
            throw error;
        }
    }

    async function fetchMe(): Promise<User | null> {
        if (!token.value) {
            user.value = null;
            isInitialized.value = true;
            return null;
        }

        try {
            const res = await $fetch<{ user: User }>("/api/auth/me", {
                headers: { Authorization: `Bearer ${token.value}` },
            });
            user.value = res.user;
            return res.user;
        } catch {
            clearAuth();
            return null;
        } finally {
            isInitialized.value = true;
        }
    }

    async function logout(redirect = true) {
        clearAuth();

        if (redirect) {
            await navigateTo("/login");
        }
    }

    return {
        token,
        user,
        isLoggedIn,
        isInitialized,
        login,
        register,
        fetchMe,
        logout,
    };
}