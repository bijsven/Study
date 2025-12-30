<script lang="ts">
    import { onMount } from "svelte";
    import { pb } from "$lib";
    import { slide, fade, fly } from "svelte/transition";
    import { Flame } from "lucide-svelte";

    let sessions: any[] = [];
    let expandedGroups = $state(new Set<string>());
    let show = $state("time") as "score" | "time";

    let { onClose } = $props();
    let groupedSessions: { date: string; items: any[]; total: number }[] =
        $state([]);

    onMount(async () => {
        const userId = pb.authStore?.record?.id;

        const data = await pb.collection("studyuren").getFullList({
            filter: `user = "${userId}"`,
            sort: "-date",
            limit: 50,
        });
        sessions = data;

        const groups: Record<
            string,
            { date: string; items: any[]; total: number }
        > = {};
        for (const s of sessions) {
            const date = new Date(s.date).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "short",
            });
            if (!groups[date]) groups[date] = { date, items: [], total: 0 };
            groups[date].items.push(s);
            groups[date].total += s.duration;
        }
        groupedSessions = Object.values(groups);
    });

    const formatDur = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        return h > 0 ? `${h}u ${m}m` : `${m}m`;
    };

    function toggle(id: string) {
        if (expandedGroups.has(id)) {
            expandedGroups = new Set();
        } else {
            expandedGroups = new Set([id]);
        }
    }
</script>

<div
    transition:fade
    class="absolute top-0 left-0 inset-0 h-full w-full flex flex-col justify-center items-center backdrop-blur-xl bg-black/80 z-20 overflow-y-auto"
>
    <div class="flex items-center w-lg justify-between mb-5">
        <button
            in:fly={{ duration: 200, y: 5 }}
            class="text-sm opacity-35 duration-200 hover:opacity-100 mt-8 cursor-pointer"
            onclick={show == "time"
                ? () => (show = "score")
                : () => (show = "time")}
            >{show == "time" ? "Score" : "Tijd"}</button
        >
        <button
            class="opacity-35 duration-200 hover:opacity-100 mt-8 cursor-pointer bg-white/15 text-white rounded-xl size-5 text-xs"
            onclick={onClose}>X</button
        >
    </div>
    <div class="max-h-[70%] flex flex-col overflow-y-auto px-4 relative">
        {#each groupedSessions as group (group.date)}
            <div class="flex flex-col gap-1 w-lg">
                <button
                    class="flex gap-2 py-2 justify-between cursor-pointer items-center text-sm opacity-65 hover:opacity-100 duration-200
                           {expandedGroups.has(group.date)
                        ? 'sticky top-0  opacity-100 z-10'
                        : ''}"
                    onclick={() => toggle(group.date)}
                >
                    <p class="text-nowrap">{group.date}</p>
                    <div class="w-full h-px bg-white/20"></div>
                    <p class="text-nowrap">{formatDur(group.total)} / 2u</p>
                </button>

                {#if expandedGroups.has(group.date)}
                    <div
                        transition:slide={{ duration: 250 }}
                        class="flex flex-col gap-2 text-xs text-white opacity-90 px-2 pt-1 rounded-md shadow-md"
                    >
                        {#each group.items as session}
                            <div
                                class="flex gap-2 justify-between cursor-pointer items-center text-sm opacity-65 hover:opacity-100 duration-200"
                            >
                                <p class="text-nowrap">
                                    {new Date(session.date).toLocaleTimeString(
                                        "nl-NL",
                                        { hour: "2-digit", minute: "2-digit" },
                                    )}
                                </p>
                                <div class="w-full h-px bg-white/20"></div>
                                {#if show === "time"}
                                    <p
                                        in:fly={{ duration: 200, x: 5 }}
                                        class="text-nowrap"
                                    >
                                        {formatDur(session.duration)}
                                    </p>
                                {:else}
                                    <p
                                        in:fly={{ duration: 200, x: 5 }}
                                        class="flex gap-1"
                                    >
                                        {session.score}
                                    </p>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>
