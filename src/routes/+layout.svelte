<script lang="ts">
    import favicon from "$lib/assets/favicon.png";
    import { pb } from "@/index";
    import { onMount, onDestroy } from "svelte";
    import { injectAnalytics } from "@vercel/analytics/sveltekit";

    import "./layout.css";
    import { goto } from "$app/navigation";
    import { ChevronLeft } from "@jis3r/icons";
    import { page } from "$app/state";

    let isHoveredHome = $state(false);

    let { children } = $props();

    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let onlineUsersInterval: ReturnType<typeof setInterval> | null = null;

    onMount(async () => {
        await pb.collection("users").authRefresh();

        if (
            !pb.authStore.isValid &&
            !window.location.pathname.includes("migrate") &&
            !window.location.pathname.includes("callback") &&
            !window.location.pathname.includes("account")
        ) {
            goto("/account");
        }

        if (pb.authStore.isValid && pb.authStore.record) {
            try {
                await pb.collection("users").update(pb.authStore.record.id, {
                    ping: new Date().toISOString(),
                });

                pingInterval = setInterval(async () => {
                    if (pb.authStore.isValid && pb.authStore.record) {
                        try {
                            await pb
                                .collection("users")
                                .update(pb.authStore.record.id, {
                                    ping: new Date().toISOString(),
                                });
                        } catch (e) {
                            console.error("Ping update failed:", e);
                        }
                    }
                }, 5000);
            } catch (e) {
                console.error("Initial ping failed:", e);
            }
        }
    });

    onDestroy(() => {
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
        if (onlineUsersInterval) {
            clearInterval(onlineUsersInterval);
            onlineUsersInterval = null;
        }
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

{#if page.url.pathname !== "/"}
    <a
        onmouseenter={() => {
            isHoveredHome = true;
            setTimeout(() => {
                isHoveredHome = false;
            }, 500);
        }}
        href={page.url.pathname.includes("/breaks/") ? "/breaks" : "/"}
        class=" absolute duration-200 z-50 bottom-8 lg:flex hidden
            left-8 gap-1 hover:scale-101
            hover:font-semibold opacity-45 text-xs hover:opacity-100
            cursor-pointers justify-center items-center
            {page.url.pathname.includes('breaks') ? 'text-black' : 'text-white'}
            "
    >
        <ChevronLeft size={16} isHovered={isHoveredHome} />
        {page.url.pathname.includes("/breaks/") ? "Terug" : "Home"}
    </a>
{/if}

{@render children()}
