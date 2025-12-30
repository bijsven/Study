<script lang="ts">
    import favicon from "$lib/assets/favicon.png";
    import { pb } from "@/index";
    import { onMount } from "svelte";

    import "./layout.css";
    import { goto } from "$app/navigation";
    import { ChevronLeft } from "@jis3r/icons";
    import { page } from "$app/state";

    let { children } = $props();

    onMount(() => {
        if (
            !pb.authStore.isValid &&
            !window.location.pathname.includes("migrate") &&
            !window.location.pathname.includes("callback") &&
            !window.location.pathname.includes("account")
        ) {
            goto("/account");
        }
    });
</script>

<svelte:head>
    <link rel="icon" href={favicon} />
</svelte:head>

{#if page.url.pathname !== "/"}
    <a
        href="/"
        class=" absolute duration-200 z-50 bottom-8 lg:flex hidden
            left-8 gap-1 hover:gap-[0.4rem] hover:scale-101
            hover:font-semibold opacity-45 text-xs hover:opacity-100
            cursor-pointers justify-center items-center
            {page.url.pathname.includes('breaks') ? 'text-black' : 'text-white'}
            "
    >
        <ChevronLeft size={16} /> Thuis
    </a>
{/if}

{@render children()}
