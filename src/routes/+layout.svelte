<script lang="ts">
    import favicon from "$lib/assets/favicon.png";
    import { pb } from "@/index";
    import { onMount, onDestroy } from "svelte";
    import { injectAnalytics } from "@vercel/analytics/sveltekit";
    import { injectSpeedInsights } from "@vercel/speed-insights/sveltekit";

    import "./layout.css";
    import { goto } from "$app/navigation";
    import { ChevronLeft } from "@jis3r/icons";
    import { page } from "$app/state";

    let isHoveredHome = $state(false);

    let { children } = $props();

    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let onlineUsersInterval: ReturnType<typeof setInterval> | null = null;

    onMount(async () => {
        const startTime = Date.now();
        const refreshDelayTime = 15 * 60 * 1000;

        const checkAndRefresh = () => {
            const timeElapsed = Date.now() - startTime;
            if (
                timeElapsed > refreshDelayTime &&
                (document.hidden || !document.hidden)
            ) {
                window.location.reload();
            }
        };

        document.addEventListener("visibilitychange", checkAndRefresh);
        setTimeout(checkAndRefresh, refreshDelayTime);

        if (
            !(page.url.pathname == "/callback") &&
            !(page.url.pathname == "/migrate")
        ) {
            try {
                await pb.collection("users").authRefresh();
            } catch {
                goto("/account");
                return;
            }

            if (!pb.authStore.isValid) {
                goto("/account");
                return;
            }
        }

        injectAnalytics();
        injectSpeedInsights();

        if (
            !pb.authStore.isValid &&
            !window.location.pathname.includes("migrate") &&
            !window.location.pathname.includes("callback") &&
            !window.location.pathname.includes("account")
        ) {
            goto("/account");
            return;
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

{#if import.meta.env.DEV}
    <div class="pointer-events-none opacity-100 z-9999 inset-0 fixed">
        <div
            class="fixed inset-0 z-9998 pointer-events-none border-red-600 border-5"
        ></div>
        <div
            class="fixed inset-0 z-9999 pointer-events-none rounded-2xl border-red-600 border-5"
        >
            <div
                class="absolute -top-1 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] font-bold px-3 py-1 rounded-b-lg uppercase tracking-wider"
            >
                Dev Mode
            </div>
        </div>
    </div>
{/if}

{#if page.url.pathname !== "/"}
    <a
        onmouseenter={() => {
            isHoveredHome = true;
            setTimeout(() => {
                isHoveredHome = false;
            }, 500);
        }}
        onclick={(e) => {
            if (
                page.url.pathname.includes("/breaks/") ||
                page.url.pathname.includes("/_system")
            ) {
                e.preventDefault();
                history.back();
            }
        }}
        href="/"
        class="absolute duration-200 z-50 bottom-8 flex lg:left-8 left-[50%] lg:translate-x-0 translate-x-[-50%]
            gap-1 hover:scale-101
            lg:hover:font-semibold lg:opacity-45 text-xs lg:hover:opacity-100
            px-3 py-2 rounded-lg bg-black/80 text-white backdrop-blur-xl
            cursor-pointer justify-center items-center
            {page.url.pathname.includes('breaks') ||
        page.url.pathname.includes('_system')
            ? 'text-black'
            : 'text-white'}"
    >
        <ChevronLeft size={16} isHovered={isHoveredHome} />
        {page.url.pathname.includes("/breaks/") ||
        page.url.pathname.includes("/_system")
            ? "Terug"
            : "Home"}
    </a>
{/if}

{#if pb.authStore.record?.ban}
    <img
        src="/assets/blocked.png"
        class="absolute object-cover h-full w-full inset-0 top-0 left-0"
        alt="blocked"
    />
{:else}
    {@render children()}
{/if}
