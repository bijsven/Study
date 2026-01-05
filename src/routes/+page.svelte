<script lang="ts">
    import { goto } from "$app/navigation";
    import { pb } from "@/index";
    import { ChevronRight } from "lucide-svelte";
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";

    let loaded = $state(false);

    onMount(() => {
        if (!pb.authStore.isValid) {
            window.location.href = "/account";
        } else {
            loaded = true;
        }
    });
</script>

<svelte:head>
    <title>Study (een app bijsven)</title>
</svelte:head>

<div class="absolute h-full w-full inset-0 top-0 left-0 bg-black">
    <div>
        <img
            src="/assets/background/5.webp"
            alt="background"
            class="h-full w-full object-cover absolute top-0 left-0"
            draggable="false"
            in:fade
        />
        <div
            class="backdrop-blur-xl bg-black/50 inset-0 h-full w-full absolute top-0 left-0"
        ></div>
    </div>

    {#if loaded}
        <div
            class="z-10 top-0 left-0 text-white absolute h-full w-full flex lg:justify-between justify-center flex-col lg:flex-row items-center px-8 lg:px-52"
        >
            <div class="lg:w-96">
                <p
                    transition:fly={{ duration: 300, y: 5 }}
                    class="text-3xl font-semibold"
                >
                    Hey {pb.authStore.record!.username}!
                </p>
                <p
                    class="opacity-80 mt-1"
                    transition:fly={{ duration: 300, y: 5, delay: 50 }}
                >
                    Selecteer een van de onderstaande services om door te gaan.
                </p>
                <div class="flex gap-8 mt-4">
                    <button
                        transition:fly={{ duration: 300, y: 5, delay: 100 }}
                        onclick={() => {
                            goto("/account");
                            localStorage.setItem("history", "/account");
                        }}
                        class="opacity-65 hover:opacity-100 hover:scale-101 duration-300 w-min cursor-pointer"
                    >
                        Account
                    </button>
                    <button
                        transition:fly={{ duration: 300, y: 5, delay: 150 }}
                        onclick={() => {
                            goto("/study");
                            localStorage.setItem("history", "/study");
                        }}
                        class="opacity-65 hover:opacity-100 hover:scale-101 duration-300 w-min cursor-pointer"
                    >
                        Studyuren
                    </button>
                    <button
                        transition:fly={{ duration: 300, y: 5, delay: 200 }}
                        onclick={() => {
                            goto("/breaks");
                            localStorage.setItem("history", "/breaks");
                        }}
                        class="opacity-65 hover:opacity-100 hover:scale-101 duration-300 w-min cursor-pointer"
                    >
                        Tussenuren
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
