// composables/useApi.ts
export function useApi() {
    // Change "token" to "dmqt_token" to match what's in your browser
    const token = useCookie("dmqt_token");

    async function $api<T>(
        url: string,
        opts: RequestInit = {},
    ): Promise<T> {
        // Just for safety: log it here once to be sure
        // console.log("Current Token:", token.value);

        const res = await $fetch<T>(url, {
            ...opts,
            headers: {
                ...opts.headers,
                Authorization: `Bearer ${token.value}`,
            },
        } as any);
        return res;
    }

    return { $api };
}