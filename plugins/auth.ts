//plugins/auth.ts
export default defineNuxtPlugin(async () => {
    const { token, user, fetchMe, isInitialized } = useAuth();

    // Ha már inicializálva van (pl. SSR után kliens oldalon), nem futtatjuk újra
    if (isInitialized.value) return;

    // Ha van token, de nincs user betöltve, töltsük be
    if (token.value && !user.value) {
        await fetchMe();
    } else {
        // Nincs token, nincs mit betölteni
        isInitialized.value = true;
    }
});