// middleware/auth.ts
export default defineNuxtRouteMiddleware(async () => {
    const { isLoggedIn, isInitialized, fetchMe, token } = useAuth();

    if (!isInitialized.value) {
        await fetchMe();
    }

    if (!isLoggedIn.value) {
        return navigateTo("/login");
    }
});