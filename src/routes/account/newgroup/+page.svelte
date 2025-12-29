<script lang="ts">
    import { goto } from "$app/navigation";
    import { pb } from "@/index";
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";

    let appstate = $state(0);
    let groupname = $state("");
    let groupres = $state() as any;

    async function createGroup() {
        if (appstate !== 1) {
            pb.collection("users").authRefresh();

            const groupres = await pb.collection("groups").create({
                name: groupname,
            });

            const groups = [
                ...(pb.authStore.record?.groups ?? []),
                groupres.id,
            ];

            console.log(groups);

            await pb
                .collection("users")
                .update(pb.authStore.record?.id!, { groups });

            appstate = 1;

            setTimeout(() => {
                goto("/account");
            }, 3000);
        }
    }
</script>

<svelte:head>
    <title>Nieuwe groep - Study</title>
</svelte:head>

<div class="absolute h-full w-full inset-0 top-0 left-0 bg-black">
    <div>
        <img
            src="/assets/background/3.webp"
            alt="background"
            class="h-full w-full object-cover absolute top-0 left-0"
            draggable="false"
            in:fade
        />
        <div
            class="backdrop-blur-xl bg-black/50 inset-0 h-full w-full absolute top-0 left-0"
        ></div>
    </div>

    <div
        class="z-10 top-0 left-0 text-white absolute h-full w-full flex lg:flex-row flex-col justify-center lg:justify-between items-center px-8 overflow-hidden lg:px-52"
    >
        <div class="lg:w-96">
            <p class="text-3xl font-semibold">Nieuwe groep</p>
            <p class="opacity-65 mt-1">
                Met groepen kan je de tussenuren van je vrienden zien, samen
                studeren en nog veel meer. Om een groep te maken vul je het
                formulier hiernaast in.
            </p>
        </div>

        <div
            class="flex flex-col gap-3 lg:h-128 lg:mt-0 mt-12 justify-center items-center overflow-y-auto p-3 min-w-fit"
        >
            <div
                class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
            >
                <!-- svelte-ignore a11y_autofocus -->
                {#if appstate == 0}
                    <input
                        onkeydown={(e) => {
                            if (e.key == "Enter") {
                                createGroup();
                            }
                        }}
                        bind:value={groupname}
                        autofocus
                        maxlength="20"
                        placeholder="Groepsnaam"
                        class="h-full w-full rounded-2xl bg-transparent px-5 text-white placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                    />
                {:else}
                    <input
                        in:fly={{ duration: 300, x: 5 }}
                        value={groupname}
                        placeholder="Groepsnaam"
                        disabled
                        title="Groep ID"
                        class="h-full w-full cursor-not-allowed opacity-65 rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/50 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                    />
                {/if}
            </div>

            {#key appstate}
                <button
                    in:fly={{ duration: 300, y: -5 }}
                    onclick={createGroup}
                    class="text-right w-full opacity-65 duration-300 pr-1 {appstate ==
                    0
                        ? 'cursor-pointer hover:opacity-100'
                        : 'cursor-not-allowed'}"
                >
                    {appstate == 1 ? "Groep aangemaakt!" : "Groep maken"}
                </button>
            {/key}
        </div>
    </div>
</div>
