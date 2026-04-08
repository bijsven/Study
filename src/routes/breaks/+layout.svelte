<script lang="ts">
    import "../app.css";
    import favicon from "$lib/assets/favicon.png";
    import { onMount } from "svelte";
    import { pb } from "$lib/index";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

    import { ModeWatcher } from "mode-watcher";
    import Loading from "@/ui/loading.svelte";

    let { children } = $props();

    let mounted = $state(false);

    onMount(() => {
        mounted = true;
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
    <title>Tussenuren</title>
</svelte:head>

<ModeWatcher />

{#if mounted && (!pb.authStore.record?.data.somtoday_calendar || !pb.authStore.record?.data.somtoday_calendar.includes("api.somtoday.nl"))}
    <div
        class="backdrop-blur-xl bg-black/75 z-9998 absolute top-0 left-0 h-full w-full"
        transition:fade={{ duration: 500 }}
    ></div>

    <div
        in:fly={{ duration: 500, y: -10, easing: cubicOut }}
        out:fly={{ duration: 500, y: 10 }}
        class="absolute top-[50%] left-[50%] z-9999 translate-x-[-50%] translate-y-[-50%] flex flex-col items-center gap-4 px-6 py-8 max-w-md w-full"
    >
        <div class="flex items-left gap-2 text-white text-2xl">
            <h1 class="font-semibold">Somtoday niet gekoppeld</h1>
        </div>

        <p class="text-white/60 text-sm leading-relaxed text-left">
            Om Tussenuren te gebruiken moet je je Somtoday-agenda koppelen.
            <br /><br />
            Ga naar leerling.somtoday.nl, open je profiel en ga naar
            <strong>Agenda</strong>. Klik op <strong>Aan de slag</strong> en
            kopieer de agenda-link.
            <br /><br />
            Plak deze link daarna op je accountpagina in Study. Zodra dat is gedaan
            kunnen jouw tussenuren (en die van anderen) worden weergegeven.
        </p>

        <div class="flex gap-5 items-center justify-center">
            <a
                href="/account"
                class="text-white/70 hover:text-white cursor-pointer duration-300 text-sm text-center"
            >
                Account bijwerken
            </a>
        </div>
    </div>
{:else if mounted}
    <content class="flex justify-center">
        {@render children?.()}
    </content>
{:else}
    <div out:fade>
        <Loading />
    </div>
{/if}
