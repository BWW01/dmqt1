// middleware/auth.ts
export default defineNuxtRouteMiddleware(async () => {
    const { isLoggedIn, isInitialized, fetchMe, token } = useAuth();

    // Várjuk meg az inicializálást, ha még nem történt meg
    if (!isInitialized.value && token.value) {
        await fetchMe();
    }

    if (!isLoggedIn.value) {
        return navigateTo("/login");
    }
});