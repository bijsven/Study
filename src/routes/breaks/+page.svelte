<script lang="ts">
    import { goto } from "$app/navigation";
    import { pb } from "$lib/index";
    import Loading from "@/ui/loading.svelte";
    import { ChevronRight } from "lucide-svelte";
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";

    let loaded = $state(false);
    let groups = $state([]) as {
        id: string;
        name: string;
    }[];

    onMount(async () => {
        const groupsid = pb.authStore.record!.groups;

        for (const group of groupsid) {
            groups.push(await pb.collection("groups").getOne(group));
        }

        if (
            localStorage.getItem("breaks:last") &&
            !sessionStorage.getItem("breaks:frs")
        ) {
            goto(`/breaks/${localStorage.getItem("breaks:last")}`);
            sessionStorage.setItem("breaks:frs", "true");
            return;
        }

        setTimeout(() => {
            loaded = true;
        }, 500);
    });
</script>

<content
    class="absolute h-full w-full dark:bg-black bg-white flex justify-center items-center"
>
    {#if loaded}
        <div
            in:fly={{ duration: 500, y: 20, delay: 1000 }}
            class="absolute top-[50%] left-[50%] translate-x-[-50%] translate-y-[-50%] flex flex-col gap-4"
        >
            <h1
                in:fly={{ duration: 500, y: 20 }}
                out:fly={{ duration: 500, y: -20, delay: 250 }}
                class="text-3xl font-semibold dark:text-white text-black falt"
            >
                Tussenuren
            </h1>
            <p class="-mt-4 text-sm opacity-65 falt dark:text-white text-black">
                Kies een groep om door te gaan...
            </p>

            <div class="w-96 flex flex-col gap-2">
                {#each groups as group}
                    <button
                        onclick={() => {
                            goto(`/breaks/${group.id}`);
                        }}
                        class="w-full cursor-pointer px-4 py-3 text-left border border-gray-200 rounded-lg hover:border-gray-400 hover:bg-gray-50 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
                    >
                        <div class="flex justify-between items-center">
                            <div>
                                <div
                                    class="font-medium text-black dark:text-white"
                                >
                                    {group.name}
                                </div>
                                <div
                                    class="text-[0.65rem] text-gray-500 dark:text-gray-400"
                                >
                                    {group.id}
                                </div>
                            </div>
                            <div class="text-gray-400 dark:text-gray-500">
                                <ChevronRight />
                            </div>
                        </div>
                    </button>
                {:else}
                    <p class="dark:text-white text-black">
                        Het lijkt erop dat je geen groep hebt, wil je er een <a
                            href="/account"
                            class="underline">toevoegen</a
                        >? Dat kan je doen door op "groepen" te klikken, en
                        daarna onderaan een code in te vullen en op ENTER te
                        drukken.
                    </p>
                {/each}
            </div>
        </div>
    {:else}
        <Loading />
    {/if}
</content>
