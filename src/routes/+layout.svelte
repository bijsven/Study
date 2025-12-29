<script lang="ts">
    import favicon from "$lib/assets/favicon.png";
    import { pb } from "@/index";
    import { onMount } from "svelte";

    import "./layout.css";
    import { goto } from "$app/navigation";

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

{@render children()}
