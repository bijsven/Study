<script lang="ts">
    import Zap from "@lucide/svelte/icons/zap";
    import Trophy from "@lucide/svelte/icons/trophy";
    import Medal from "@lucide/svelte/icons/medal";
    import Award from "@lucide/svelte/icons/award";
    import X from "@lucide/svelte/icons/x";
    import { cubicOut } from "svelte/easing";
    import { fade, fly } from "svelte/transition";
    import { onMount } from "svelte";
    import { pb } from "$lib";
    import NumberFlow, { continuous } from "@number-flow/svelte";
    import { Confetti } from "svelte-confetti";
    import { ArrowLeft, Cog, Flame, Clock, History } from "lucide-svelte";
    import { Lightbulb } from "@jis3r/icons";

    interface Player {
        id: string;
        name: string;
        xp: number;
        streak: number;
        visible: boolean;
    }

    type TimeFrame = "week" | "month" | "all";

    const { callback, onOpenSessionHistory } = $props();

    let players = $state<Player[]>([]);
    let loading = $state(true);
    let activeTab = $state<TimeFrame>("week");
    let allData = $state<any[]>([]);

    let activeGroup = $state("default");
    let groupName = $state("Leaderboard");
    let showConfetti = $state(false);
    let currentUserStreak = $state(0);

    onMount(async () => {
        if (activeGroup === "default") {
            activeGroup = pb.authStore.record!.groups[0];
        }

        groupName =
            (await pb.collection("groups").getOne(activeGroup)).name ||
            "Leaderboard";

        try {
            const data = await pb.collection("studyuren_lookup").getFullList({
                filter: `user.groups ~ "${activeGroup}"`,
                expand: "user",
            });

            allData = data;
            updatePlayersList(activeTab);

            // Get current user's streak
            const currentUserData = data.find(
                (d: any) => d.user === pb.authStore.record!.id,
            );
            if (currentUserData) {
                currentUserStreak = currentUserData.streak ?? 0;
            }
        } catch (error) {
            console.error("Failed to retrieve leaderboard:", error);
        } finally {
            loading = false;
        }
    });

    function updatePlayersList(timeFrame: TimeFrame) {
        players = allData
            .map((record: any) => {
                let xp = 0;

                switch (timeFrame) {
                    case "week":
                        xp = record.weekly_score ?? 0;
                        break;
                    case "month":
                        xp = record.monthly_score ?? 0;
                        break;
                    case "all":
                        xp = record.all_score ?? 0;
                        break;
                }

                return {
                    id: record.user,
                    name: record.expand?.user?.username || "undefined",
                    xp,
                    streak: record.streak ?? 0,
                    visible: false,
                };
            })
            .sort((a, b) => b.xp - a.xp);

        showConfetti =
            players.length > 0 && players[0].id === pb.authStore.record!.id;
    }

    function setActiveTab(tab: TimeFrame) {
        if (activeTab === tab) return;
        activeTab = tab;

        players = [];
        updatePlayersList(tab);
    }

    function getRankIcon(rank: number) {
        switch (rank) {
            case 1:
                return Trophy;
            case 2:
                return Medal;
            case 3:
                return Award;
            default:
                return null;
        }
    }

    function formatXP(xp: number): string {
        return xp.toLocaleString("nl-NL");
    }

    function getTabLabel(tab: TimeFrame): string {
        switch (tab) {
            case "week":
                return "Weekelijks";
            case "month":
                return "Maandelijks";
            case "all":
                return "Altijd";
        }
    }
</script>

<div
    role="button"
    tabindex="0"
    in:fade={{ duration: 650, easing: cubicOut }}
    out:fade={{ duration: 450, delay: 400 }}
    class="absolute top-0 left-0 h-full w-full flex z-50 overflow-hidden bg-black/30 backdrop-blur-xl justify-center items-center"
>
    <div class="flex flex-col items-center gap-6 max-w-md w-full px-6">
        {#key players}
            {#if showConfetti}
                <div class="absolute">
                    <Confetti
                        x={[-2, 2]}
                        delay={[1000, 2000]}
                        duration={2000}
                        amount={250}
                        size={15}
                        fallDistance="100vh"
                    />
                </div>
            {/if}
        {/key}

        <div class="flex flex-col items-center gap-4 w-full">
            <!-- Streak Panel -->
            <p
                class="absolute bottom-24 text-sm opacity-65 flex gap-1 items-center"
            >
                <Flame class="size-4 text-orange-400" />{currentUserStreak}
                dagen
            </p>
            <button
                onclick={(e) => {
                    e.stopPropagation();
                    onOpenSessionHistory?.();
                }}
                class="p-2 hover:bg-white/10 absolute bottom-12 right-12 cursor-pointer rounded-lg transition-all flex items-center gap-2 text-white/60 hover:text-white/90"
            >
                <History class="w-5 h-5" />
            </button>

            <div
                class="flex flex-col items-center justify-center gap-2 text-white text-2xl"
            >
                <p
                    in:fly={{
                        duration: 650,
                        y: -10,
                        easing: cubicOut,
                        delay: 350,
                    }}
                    out:fly={{ duration: 650, y: -10, easing: cubicOut }}
                    class="text-xs opacity-45 -mb-2"
                >
                    Leaderboard
                </p>
                <h1
                    in:fly={{
                        duration: 800,
                        y: -10,
                        easing: cubicOut,
                        delay: 500,
                    }}
                    out:fly={{ duration: 800, y: -10, easing: cubicOut }}
                    class="font-semibold"
                >
                    {groupName}
                </h1>
            </div>
        </div>

        <div
            in:fly={{ duration: 250, y: -10, easing: cubicOut, delay: 650 }}
            out:fly={{ duration: 250, y: -10, easing: cubicOut }}
            class="flex gap-2 w-full rounded-xl bg-white/5 p-1 border border-white/10"
            onclick={(e) => {
                e.stopPropagation();
            }}
            role="tablist"
            tabindex="0"
            onkeydown={(e) => {
                e.stopPropagation();
            }}
        >
            {#each ["week", "month", "all"] as tab}
                <button
                    onclick={(e) => {
                        e.stopPropagation();
                        setActiveTab(tab as TimeFrame);
                    }}
                    class="flex-1 py-2 cursor-pointer px-4 rounded-lg text-sm font-medium transition-all duration-200 {activeTab ===
                    tab
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:bg-white/5 hover:text-white/70'}"
                >
                    {#if tab === "week"}
                        <span>Deze week</span>
                    {:else if tab === "month"}
                        <span>Deze maand</span>
                    {:else if tab === "all"}
                        <span>Altijd</span>
                    {/if}
                </button>
            {/each}
        </div>

        {#if loading}
            <div
                in:fade={{
                    duration: 1000,
                    easing: cubicOut,
                    delay: 1000,
                }}
                class="w-full space-y-2 overflow-y-auto min-h-32 max-h-64 pr-2 simplescrollbar self-start shrink-0"
            >
                {#each Array(10) as _, i}
                    <div
                        in:fly|global={{
                            duration: 650,
                            y: -10,
                            easing: cubicOut,
                            delay: i * 100,
                        }}
                        class="flex items-center animate-pulse gap-4 px-4 py-3 h-14 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
                    ></div>
                {/each}
            </div>
        {:else if players.length === 0}
            <div class="text-white/50 text-sm">
                Nog geen spelers in deze periode
            </div>
        {:else}
            <div
                in:fly={{
                    duration: 450,
                    y: -10,
                    easing: cubicOut,
                    delay: 650,
                }}
                out:fly={{ duration: 450, y: 10, easing: cubicOut }}
                class="w-full space-y-2 overflow-y-auto min-h-32 max-h-64 pr-2 simplescrollbar self-start shrink-0"
            >
                {#key players}
                    {#each players as player, i}
                        <div
                            in:fly|global={{
                                duration: 300,
                                y: -10,
                                easing: cubicOut,
                                delay: i * 100,
                            }}
                            class="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border {player.id ===
                            localStorage.getItem('user:id')
                                ? 'border-white/25'
                                : 'border-white/10'}"
                        >
                            <div
                                class="shrink-0 w-6 flex items-center justify-center"
                            >
                                {#if getRankIcon(i + 1)}
                                    {@const IconComponent = getRankIcon(i + 1)}
                                    {#if i === 0}
                                        <IconComponent
                                            class="w-5 h-5 text-amber-300"
                                            fill="oklch(87.9% 0.169 91.605)"
                                        />
                                    {:else if i === 1}
                                        <IconComponent
                                            class="w-5 h-5 text-slate-300"
                                        />
                                    {:else}
                                        <IconComponent
                                            class="w-5 h-5 text-amber-700"
                                        />
                                    {/if}
                                {:else}
                                    <span
                                        class="text-white/40 text-sm font-medium"
                                    >
                                        {i + 1}
                                    </span>
                                {/if}
                            </div>

                            <div class="flex-1 min-w-0">
                                <p
                                    class="text-white text-sm font-medium truncate text-left"
                                >
                                    {player.name}
                                </p>
                                {#if player.streak > 0}
                                    <div
                                        class="flex items-center gap-1 text-orange-400/80 text-xs mt-0.5"
                                    >
                                        <Flame class="w-3 h-3" />
                                        <span>{player.streak} dagen</span>
                                    </div>
                                {/if}
                            </div>

                            <div
                                class="flex items-center gap-1.5 text-amber-300"
                            >
                                <Zap
                                    class="w-3.5 h-3.5"
                                    fill="oklch(87.9% 0.169 91.605)"
                                />
                                <NumberFlow
                                    value={player.xp}
                                    class="text-sm font-semibold"
                                ></NumberFlow>
                            </div>
                        </div>
                    {/each}
                {/key}
            </div>
        {/if}

        <button
            onclick={() => {
                callback();
                window.SetWallpaper();
            }}
            class="text-white/30 hover:text-white/70 cursor-pointer duration-300 text-sm absolute top-12 right-12 text-center flex gap-2 items-center justify-center"
        >
            Instellingen <Cog class="size-4" />
        </button>

        <button
            onclick={() => {
                callback();
            }}
            class="text-white/30 hover:text-white/70 cursor-pointer duration-300 text-sm absolute top-12 left-12 text-center flex gap-1 items-center justify-center"
        >
            <ArrowLeft class="size-4" /> Terug
        </button>
    </div>
</div>

<style>
    .simplescrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
    }

    .simplescrollbar::-webkit-scrollbar {
        width: 8px;
    }

    .simplescrollbar::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.05);
    }

    .simplescrollbar::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 9999px;
    }
</style>
