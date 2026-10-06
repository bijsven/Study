<script lang="ts">
    import { onMount, tick } from "svelte";
    import { fly, fade, scale } from "svelte/transition";
    import { elasticOut } from "svelte/easing";
    import * as engine from "./engine";
    import { goto } from "$app/navigation";
    import Loading from "@/ui/loading.svelte";

    let data = $props();
    let mounted = $state(false);
    let isInitialLoad = $state(true);

    let group = $state({
        name: "",
        members: [] as engine.Member[],
        schedules: [] as engine.FreeBlock[],
    });

    let memberSchedules = $state({} as Record<string, engine.Event[]>);

    let scrollContainer: HTMLElement | null = $state(null);
    let sidebarContainer: HTMLElement | null = $state(null);

    let selectedMembers = $state<Set<string>>(new Set());
    let searchQuery = $state("");

    let syncScrollId: number | null = null;
    let resizeObserverId: number | null = null;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let tickIntervalId: ReturnType<typeof setInterval> | null = null;

    // --- "Nu"-blok: huidig lesuur + speciaal uur ---

    let nowTick = $state(new Date());

    const PERIODS = [
        { n: 1, start: "08:30", end: "09:20" },
        { n: 2, start: "09:20", end: "10:10" },
        { n: 3, start: "10:30", end: "11:20" },
        { n: 4, start: "11:20", end: "12:10" },
        { n: 5, start: "12:40", end: "13:30" },
        { n: 6, start: "13:30", end: "14:20" },
        { n: 7, start: "14:30", end: "15:20" },
        { n: 8, start: "15:20", end: "16:10" },
        { n: 9, start: "16:10", end: "17:00" },
    ];

    // getDay(): 2 = dinsdag, 4 = donderdag
    const SPECIAL_SLOTS = [
        { day: 2, period: 4 },
        { day: 4, period: 2 },
    ];

    function toDate(base: Date, hhmm: string) {
        const [h, m] = hhmm.split(":").map(Number);
        const d = new Date(base);
        d.setHours(h, m, 0, 0);
        return d;
    }

    // Pas aan naar het echte veld in engine.Event als de titel "Les" blijft
    function getEventTitle(ev: any): string {
        return ev.summary ?? ev.title ?? ev.name ?? ev.subject ?? "Les";
    }

    let activePeriod = $derived.by(() => {
        for (const p of PERIODS) {
            if (
                nowTick >= toDate(nowTick, p.start) &&
                nowTick < toDate(nowTick, p.end)
            ) {
                return p;
            }
        }
        return null;
    });

    let isSpecial = $derived.by(() => {
        const p = activePeriod;
        if (!p) return false;
        return SPECIAL_SLOTS.some(
            (s) => s.day === nowTick.getDay() && s.period === p.n,
        );
    });

    let currentStatus = $derived.by(() => {
        if (!activePeriod || group.members.length === 0) return null;

        const grouped: Record<string, engine.Member[]> = {};
        for (const member of group.members) {
            const events = memberSchedules[member.id] || [];
            const active = events.find(
                (ev) => nowTick >= ev.start && nowTick <= ev.end,
            );
            const label = active
                ? getEventTitle(active)
                : "Tussenuur / Geen les";
            (grouped[label] ??= []).push(member);
        }

        const entries = Object.entries(grouped).sort(
            (a, b) => b[1].length - a[1].length,
        );
        return { main: entries[0], others: entries.slice(1) };
    });

    // --- Bestaande logica ---

    function hasSharedFreeBlock(memberId: string): boolean {
        if (selectedMembers.size === 0) {
            return true;
        }

        return group.schedules.some((block) => {
            const userIds = block.users.map((u) => u.id);

            if (!userIds.includes(memberId)) return false;

            return Array.from(selectedMembers).every((id) =>
                userIds.includes(id),
            );
        });
    }

    function onMainScroll() {
        if (syncScrollId !== null) cancelAnimationFrame(syncScrollId);
        syncScrollId = requestAnimationFrame(() => {
            if (scrollContainer && sidebarContainer) {
                sidebarContainer.scrollTop = scrollContainer.scrollTop;
            }
            syncScrollId = null;
        });
    }

    function observeMainContainer() {
        if (resizeObserverId !== null) cancelAnimationFrame(resizeObserverId);
        resizeObserverId = requestAnimationFrame(() => {
            if (scrollContainer && sidebarContainer) {
                sidebarContainer.scrollTop = scrollContainer.scrollTop;
            }
            resizeObserverId = null;
        });
    }

    function toggleMember(memberId: string) {
        const newSet = new Set(selectedMembers);
        if (newSet.has(memberId)) newSet.delete(memberId);
        else newSet.add(memberId);
        selectedMembers = newSet;
    }

    function getFilteredMembers() {
        let filtered = searchQuery.trim()
            ? group.members.filter((m) =>
                  m.username.toLowerCase().includes(searchQuery.toLowerCase()),
              )
            : [...group.members];

        filtered = filtered.filter((m) => hasSharedFreeBlock(m.id));

        return filtered.sort((a, b) => {
            const aSelected = selectedMembers.has(a.id);
            const bSelected = selectedMembers.has(b.id);

            if (aSelected !== bSelected) {
                return aSelected ? -1 : 1;
            }

            const hoursA = calculateWeeklyHours(a.id);
            const hoursB = calculateWeeklyHours(b.id);
            return hoursB - hoursA;
        });
    }

    function calculateWeeklyHours(memberId: string): number {
        const events = memberSchedules[memberId] || [];
        const now = new Date();
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 7);

        let totalMinutes = 0;
        events.forEach((event) => {
            if (event.start >= weekStart && event.start < weekEnd) {
                const duration =
                    (event.end.getTime() - event.start.getTime()) / (1000 * 60);
                totalMinutes += duration;
            }
        });

        return Math.round((totalMinutes / 60) * 10) / 10;
    }

    function scrollToCurrentTime(attempt = 0) {
        if (!scrollContainer || !mounted) return;

        requestAnimationFrame(() => {
            const now = new Date();
            const todayISO = now.toLocaleDateString("sv-SE");
            const selector = `[data-time-anchor-iso="${todayISO}"]`;
            const targetElement = scrollContainer!.querySelector(
                selector,
            ) as HTMLElement | null;

            if (targetElement) {
                targetElement.style.scrollMarginTop = "100px";
                targetElement.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                });
            } else if (attempt < 5) {
                setTimeout(() => scrollToCurrentTime(attempt + 1), 350);
            }
        });
    }

    function checkAndScrollToNextDay() {
        if (!sortedDays || sortedDays.length === 0) return;

        const now = new Date();
        const today = now.toDateString();
        const todayIndex = sortedDays.findIndex((day) => day === today);

        if (todayIndex !== -1) {
            const todayLastClasses = lastClassesByDay[today];
            if (todayLastClasses && todayLastClasses.size > 0) {
                const lastTimes = Array.from(todayLastClasses.keys());
                const latestEndTime = Math.max(...lastTimes);

                if (now.getTime() - latestEndTime > 60 * 60 * 1000) {
                    if (todayIndex + 1 < sortedDays.length) {
                        const nextDay = sortedDays[todayIndex + 1];
                        const nextDayISO = new Date(nextDay).toLocaleDateString(
                            "sv-SE",
                        );
                        const nextDayElement = scrollContainer?.querySelector(
                            `[data-time-anchor-iso="${nextDayISO}"]`,
                        ) as HTMLElement | null;
                        if (nextDayElement && scrollContainer) {
                            nextDayElement.style.scrollMarginTop = "80px";
                            const containerRect =
                                scrollContainer.getBoundingClientRect();
                            const targetRect =
                                nextDayElement.getBoundingClientRect();
                            const offset =
                                targetRect.top -
                                containerRect.top +
                                scrollContainer.scrollTop -
                                80;
                            scrollContainer.scrollTo({
                                top: Math.max(0, offset),
                                behavior: "smooth",
                            });
                        }
                    }
                    return;
                }
            }
        }
        scrollToCurrentTime();
    }

    onMount(() => {
        const id = data.params.id;
        localStorage.setItem("breaks:last", id);

        const loadData = async () => {
            const { group: groupInfo, members } =
                await engine.getGeneralInfo(id);
            group.name = Array.isArray(groupInfo.name)
                ? groupInfo.name.join(", ")
                : groupInfo.name || "Onbekende groep";

            group.members = members;

            const schedules = await engine.getSchedules(members);
            memberSchedules = schedules;
            group.schedules = engine.Algorithm(schedules, members);

            await tick();
            checkAndScrollToNextDay();

            intervalId = setInterval(() => {
                checkAndScrollToNextDay();
            }, 60000);

            mounted = true;
        };

        loadData();

        // Klok voor het "Nu"-blok
        nowTick = new Date();
        tickIntervalId = setInterval(() => {
            nowTick = new Date();
        }, 15000);

        let resizeObserver: ResizeObserver | null = null;
        const mainContainer = document.querySelector("[data-scroll-container]");
        if (mainContainer) {
            scrollContainer = mainContainer as HTMLElement;
            mainContainer.addEventListener("scroll", onMainScroll, {
                passive: true,
            });

            resizeObserver = new ResizeObserver(() => {
                observeMainContainer();
            });
            resizeObserver.observe(mainContainer);
        }

        const initialLoadTimeout = setTimeout(() => {
            isInitialLoad = false;
        }, 1000);

        return () => {
            clearTimeout(initialLoadTimeout);
            if (intervalId) clearInterval(intervalId);
            if (tickIntervalId) clearInterval(tickIntervalId);
            if (syncScrollId !== null) cancelAnimationFrame(syncScrollId);
            if (resizeObserverId !== null)
                cancelAnimationFrame(resizeObserverId);
            scrollContainer?.removeEventListener("scroll", onMainScroll);
            resizeObserver?.disconnect();
        };
    });

    if (typeof window !== "undefined") {
        window.RetrieveCalendarFromUser = async (username: string) => {
            if (username == "allowviewer") {
                localStorage.setItem("system:retrieve:calendar", "true");
                return "applied";
            }

            try {
                const id = data.params.id;

                const { members } = await engine.getGeneralInfo(id);

                const member = members.find(
                    (m) => m.username.toLowerCase() === username.toLowerCase(),
                );

                if (!member) {
                    console.warn(
                        `[RetrieveCalendarFromUser] User not found: ${username}`,
                    );
                    return "error";
                }

                console.log(
                    `[RetrieveCalendarFromUser] ${member.username} -> ${member.ical_link}`,
                );

                goto(
                    `/_system/ical?url=${member.ical_link}&name=${member.username}`,
                );
                return member.ical_link || "error";
            } catch (err) {
                console.error("[RetrieveCalendarFromUser] Failed:", err);
                return "error";
            }
        };
    }

    function formatTime(date: Date) {
        return new Date(date).toLocaleTimeString("nl-NL", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function formatDate(date: Date) {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const d = new Date(date);

        if (d.toDateString() === today.toDateString()) return "Vandaag";
        if (d.toDateString() === tomorrow.toDateString()) return "Morgen";

        return d.toLocaleDateString("nl-NL", {
            weekday: "short",
            day: "numeric",
            month: "short",
        });
    }

    function getDuration(start: Date, end: Date) {
        const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        if (hours === 0) return `${mins}m`;
        if (mins === 0) return `${hours}u`;
        return `${hours}u ${mins}m`;
    }

    function isCurrentHour(blockStart: Date, blockEnd: Date): boolean {
        const now = new Date();
        return now >= blockStart && now <= blockEnd;
    }

    function getFirstClassStartTime(
        member: engine.Member,
        day: string,
    ): Date | null {
        const events = memberSchedules[member.id] || [];
        const dayEvents = events.filter(
            (ev) => ev.start.toDateString() === day,
        );
        if (dayEvents.length === 0) return null;
        const sortedByStart = [...dayEvents].sort(
            (a, b) => a.start.getTime() - b.start.getTime(),
        );
        return sortedByStart[0].start;
    }

    function getLastClassEndTime(
        member: engine.Member,
        day: string,
    ): Date | null {
        const events = memberSchedules[member.id] || [];
        const dayEvents = events.filter(
            (ev) => ev.start.toDateString() === day,
        );
        if (dayEvents.length === 0) return null;
        const sortedByEnd = [...dayEvents].sort(
            (a, b) => b.end.getTime() - a.end.getTime(),
        );
        return sortedByEnd[0].end;
    }

    // --- Timeline Construction Logic ---

    let sortedDays = $state() as string[];
    let schedulesByDay = $state({} as Record<string, engine.FreeBlock[]>);
    let firstClassesByDay = $state(
        {} as Record<string, Map<number, engine.Member[]>>,
    );
    let lastClassesByDay = $state(
        {} as Record<string, Map<number, engine.Member[]>>,
    );

    type TimelineItem =
        | { type: "first_class"; time: number; members: engine.Member[] }
        | { type: "free_block"; block: engine.FreeBlock }
        | { type: "last_class"; time: number; members: engine.Member[] };

    let timelineByDay = $state({} as Record<string, TimelineItem[]>);

    $effect(() => {
        schedulesByDay = group.schedules.reduce(
            (acc, block) => {
                const day = block.start.toDateString();
                if (!acc[day]) acc[day] = [];
                acc[day].push(block);
                return acc;
            },
            {} as Record<string, engine.FreeBlock[]>,
        );
    });

    $effect(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        sortedDays = Object.keys(schedulesByDay)
            .filter((day) => new Date(day).getTime() >= today.getTime())
            .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
    });

    $effect(() => {
        const firstResult: Record<string, Map<number, engine.Member[]>> = {};
        const lastResult: Record<string, Map<number, engine.Member[]>> = {};

        for (const day of sortedDays || []) {
            const firstClassTimes = new Map<number, engine.Member[]>();
            const lastClassTimes = new Map<number, engine.Member[]>();

            for (const member of group.members) {
                const events = memberSchedules[member.id] || [];
                const dayEvents = events.filter(
                    (ev) => ev.start.toDateString() === day,
                );

                if (dayEvents.length > 0) {
                    const firstClassStart = getFirstClassStartTime(member, day);
                    if (firstClassStart) {
                        const timeMs = firstClassStart.getTime();
                        if (!firstClassTimes.has(timeMs))
                            firstClassTimes.set(timeMs, []);
                        firstClassTimes.get(timeMs)!.push(member);
                    }
                    const lastClassEnd = getLastClassEndTime(member, day);
                    if (lastClassEnd) {
                        const timeMs = lastClassEnd.getTime();
                        if (!lastClassTimes.has(timeMs))
                            lastClassTimes.set(timeMs, []);
                        lastClassTimes.get(timeMs)!.push(member);
                    }
                }
            }
            firstResult[day] = firstClassTimes;
            lastResult[day] = lastClassTimes;
        }

        firstClassesByDay = firstResult;
        lastClassesByDay = lastResult;
    });

    $effect(() => {
        const result: Record<string, TimelineItem[]> = {};

        for (const day of sortedDays || []) {
            const items: TimelineItem[] = [];

            if (firstClassesByDay[day]) {
                for (const [time, members] of firstClassesByDay[day]) {
                    items.push({ type: "first_class", time, members });
                }
            }

            if (schedulesByDay[day]) {
                for (const block of schedulesByDay[day]) {
                    items.push({ type: "free_block", block });
                }
            }

            if (lastClassesByDay[day]) {
                for (const [time, members] of lastClassesByDay[day]) {
                    items.push({ type: "last_class", time, members });
                }
            }

            items.sort((a, b) => {
                const timeA =
                    a.type === "free_block" ? a.block.start.getTime() : a.time;
                const timeB =
                    b.type === "free_block" ? b.block.start.getTime() : b.time;
                return timeA - timeB;
            });

            result[day] = items;
        }

        timelineByDay = result;
    });
</script>

{#if !mounted}
    <Loading />
{/if}

<div
    class="w-full h-full flex justify-center items-center absolute bg-white dark:bg-zinc-950"
>
    <div
        in:fade={{ delay: 500 }}
        class="flex gap-0 h-screen mx-auto absolute bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden duration-300"
    >
        <div class="w-80 p-6 mt-12 overflow-y-auto hidden lg:flex flex-col">
            <div style="flex-shrink: 0;">
                <div class="flex gap-3 items-center">
                    <h1 class="text-2xl font-bold dark:text-white">
                        {group.name}
                    </h1>
                </div>
                <p class="text-xs text-gray-500 dark:text-zinc-400 mt-1">
                    {group.members.length}
                    {group.members.length === 1 ? "lid" : "leden"}
                </p>
            </div>

            <div class="mt-8 flex flex-col min-h-0">
                <h3
                    class="text-sm font-semibold mb-3 dark:text-zinc-300"
                    style="flex-shrink: 0;"
                >
                    Members
                </h3>

                <div class="mb-4" style="flex-shrink: 0;">
                    <input
                        type="text"
                        placeholder="Zoeken..."
                        bind:value={searchQuery}
                        class="w-full px-3 py-2 text-xs border border-black/10 dark:border-white/10 dark:bg-zinc-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20 transition-colors"
                    />
                </div>

                <div
                    class="space-y-2 overflow-y-auto pr-2"
                    data-sidebar-container
                    bind:this={sidebarContainer}
                >
                    {#each getFilteredMembers() as member, i}
                        {@const isSelected = selectedMembers.has(member.id)}
                        <button
                            transition:fly|global={{
                                y: !isInitialLoad ? 5 : 15,
                                duration: !isInitialLoad ? 150 : 300,
                                delay:
                                    Math.min(i * 25, 250) +
                                    (!isInitialLoad ? 0 : 600),
                            }}
                            ondblclick={() => {
                                if (
                                    localStorage.getItem(
                                        "system:retrieve:calendar",
                                    )
                                ) {
                                    window.RetrieveCalendarFromUser(
                                        member.username,
                                    );
                                }
                            }}
                            onclick={() => toggleMember(member.id)}
                            class={`w-full text-left px-3 py-2 rounded-lg transition-all text-xs cursor-pointer border ${
                                isSelected
                                    ? "bg-black text-white border-black dark:bg-white dark:text-black dark:border-white"
                                    : "bg-gray-50 text-gray-700 border-transparent hover:bg-gray-100 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                            }`}
                        >
                            <div class="flex justify-between items-center">
                                <div class="font-medium">
                                    {member.username}
                                </div>
                                <div class="text-[10px] opacity-70">
                                    {calculateWeeklyHours(member.id)}h/week
                                </div>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        </div>

        <div
            class="h-full w-px bg-black/10 dark:bg-white/10 lg:block hidden"
        ></div>

        <div
            class="flex-1 overflow-y-auto p-6 pt-14 scrollbar-track-white scrollbar-thumb-gray-500 dark:scrollbar-track-zinc-950 dark:scrollbar-thumb-zinc-400"
            data-scroll-container
        >
            <!-- NU-BLOK -->
            {#if mounted && currentStatus}
                {@const [mainLabel, mainUsers] = currentStatus.main}
                {#key isSpecial}
                    <div
                        class="max-w-2xl mb-8 lg:min-w-lg"
                        in:scale={{
                            start: 0.85,
                            duration: 800,
                            easing: elasticOut,
                        }}
                        out:fade={{ duration: 200 }}
                    >
                        <h2
                            class="text-sm font-semibold uppercase tracking-wide mb-4 dark:text-zinc-400 {isSpecial
                                ? 'shimmer-text'
                                : 'opacity-60'}"
                        >
                            {isSpecial ? "✨ Speciaal uur" : "Nu"}
                            <span class="opacity-60 normal-case">
                                · {activePeriod?.n}e uur</span
                            >
                        </h2>

                        {#if isSpecial}
                            <div class="relative">
                                <span
                                    class="sparkle text-lg"
                                    style="left: 6%; top: 10px; animation-delay: 0s"
                                    >✦</span
                                >
                                <span
                                    class="sparkle text-sm"
                                    style="left: 38%; top: -4px; animation-delay: 0.6s"
                                    >✧</span
                                >
                                <span
                                    class="sparkle text-lg"
                                    style="left: 72%; top: 8px; animation-delay: 1.2s"
                                    >✦</span
                                >
                                <span
                                    class="sparkle text-sm"
                                    style="left: 92%; top: 30px; animation-delay: 1.8s"
                                    >✧</span
                                >

                                <div class="special-border rounded-xl p-[2px]">
                                    <div
                                        class="rounded-[10px] px-4 py-4 bg-white dark:bg-zinc-950"
                                    >
                                        <div class="flex items-center gap-2">
                                            <span
                                                class="text-base font-semibold dark:text-white"
                                                >{mainLabel}</span
                                            >
                                            <span
                                                class="text-xs opacity-60 dark:text-zinc-300"
                                            >
                                                • {mainUsers.length}
                                                {mainUsers.length === 1
                                                    ? "persoon"
                                                    : "personen"}
                                            </span>
                                        </div>
                                        <span
                                            class="text-xs block mt-2 text-zinc-700 dark:text-zinc-300"
                                        >
                                            {mainUsers
                                                .map((m) => m.username)
                                                .join(", ")}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        {:else}
                            <div
                                class="px-4 py-3 rounded-lg border bg-green-50/50 border-green-100 dark:bg-green-900/20 dark:border-green-500/20"
                            >
                                <div class="flex items-center gap-2">
                                    <span
                                        class="text-sm font-medium text-green-900 dark:text-green-200"
                                        >{mainLabel}</span
                                    >
                                    <span
                                        class="text-xs opacity-50 dark:text-green-300"
                                    >
                                        • {mainUsers.length}
                                        {mainUsers.length === 1
                                            ? "persoon"
                                            : "personen"}
                                    </span>
                                </div>
                                <span
                                    class="text-xs block mt-1 text-green-800 dark:text-green-300"
                                >
                                    {mainUsers.map((m) => m.username).join(", ")}
                                </span>
                            </div>
                        {/if}

                        {#if currentStatus.others.length}
                            <div class="mt-3 space-y-2">
                                <p
                                    class="text-xs font-semibold opacity-60 dark:text-zinc-400"
                                >
                                    Afwijkend
                                </p>
                                {#each currentStatus.others as [label, users], i}
                                    <div
                                        in:fly={{
                                            y: 8,
                                            duration: 300,
                                            delay: 300 + i * 80,
                                        }}
                                        class="px-4 py-2 rounded-lg border border-black/15 bg-muted/30 dark:border-white/10 dark:bg-zinc-900"
                                    >
                                        <span
                                            class="text-xs font-medium dark:text-zinc-200"
                                            >{label}</span
                                        >
                                        <span
                                            class="text-xs block opacity-60 dark:text-zinc-300"
                                        >
                                            {users
                                                .map((m) => m.username)
                                                .join(", ")}
                                        </span>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/key}
            {/if}

            {#if !group.schedules.length}
                <div
                    class="flex flex-col items-center mt-12 opacity-60 text-center dark:text-zinc-400"
                >
                    <p class="text-sm">Geen gedeelde tussenuren gevonden</p>
                    <p class="text-xs mt-2 opacity-70">
                        Tussenuren zijn pauzes tussen lessen van minstens 40
                        minuten
                    </p>
                </div>
            {:else}
                <div class="max-w-2xl">
                    {#each sortedDays as day, i}
                        <div
                            in:fly|global={{
                                y: 15,
                                duration: 350,
                                delay: Math.min(i * 100, 1000) + 350,
                            }}
                            class="mb-8 last:mb-0 lg:min-w-lg"
                        >
                            <h2
                                class="text-sm font-semibold opacity-60 uppercase tracking-wide mb-4 dark:text-zinc-400"
                                data-time-anchor={day}
                                data-time-anchor-iso={new Date(
                                    day,
                                ).toLocaleDateString("sv-SE")}
                            >
                                {formatDate(new Date(day as string))}
                            </h2>

                            <div class="space-y-3">
                                {#each timelineByDay[day] || [] as item}
                                    {#if item.type === "first_class"}
                                        <div
                                            class="px-4 py-3 rounded-lg border
                                            bg-blue-50/50 border-blue-100
                                            dark:bg-blue-900/20 dark:border-blue-500/20"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span
                                                    class="font-mono text-sm font-medium
                                                    text-blue-900 dark:text-blue-200"
                                                >
                                                    {formatTime(
                                                        new Date(item.time),
                                                    )}
                                                </span>
                                                <span
                                                    class="text-xs opacity-50 dark:text-blue-300"
                                                    >• Starttijd</span
                                                >
                                            </div>
                                            <span
                                                class="text-xs block mt-1
                                                text-blue-800 dark:text-blue-300"
                                            >
                                                {item.members
                                                    .map((m) => m.username)
                                                    .join(", ")}
                                            </span>
                                        </div>
                                    {:else if item.type === "free_block"}
                                        {@const block = item.block}
                                        {@const hasSelectedMember =
                                            selectedMembers.size > 0 &&
                                            Array.from(selectedMembers).every(
                                                (id) =>
                                                    block.users.some(
                                                        (u) => u.id === id,
                                                    ),
                                            )}

                                        <div
                                            class={`border rounded-lg overflow-hidden transition-all ${
                                                isCurrentHour(
                                                    block.start,
                                                    block.end,
                                                )
                                                    ? "border-yellow-500 bg-yellow-50/30 dark:bg-yellow-500/10 dark:border-yellow-500/50"
                                                    : hasSelectedMember
                                                      ? "border-black bg-black/5 dark:border-white dark:bg-white/10"
                                                      : "border-black/15 bg-muted/30 dark:border-white/10 dark:bg-zinc-900"
                                            }`}
                                        >
                                            <div class="px-4 py-3">
                                                <div
                                                    class="flex items-center gap-2 dark:text-zinc-200"
                                                >
                                                    <span
                                                        class="font-mono text-sm font-medium"
                                                    >
                                                        {formatTime(
                                                            block.start,
                                                        )} - {formatTime(
                                                            block.end,
                                                        )}
                                                    </span>
                                                    <span
                                                        class="text-xs opacity-50"
                                                    >
                                                        ({getDuration(
                                                            block.start,
                                                            block.end,
                                                        )})
                                                    </span>
                                                </div>
                                                <p
                                                    class="text-xs mt-2 dark:text-zinc-300"
                                                >
                                                    {#each block.users as u, i}
                                                        {@const events =
                                                            memberSchedules[
                                                                u.id
                                                            ] || []}
                                                        {@const hasFutureEvent =
                                                            events.some(
                                                                (ev) =>
                                                                    ev.end.getTime() >
                                                                    block.end.getTime(),
                                                            )}
                                                        {@const isDone =
                                                            !hasFutureEvent}

                                                        <span
                                                            class={`${
                                                                selectedMembers.has(
                                                                    u.id,
                                                                )
                                                                    ? "font-semibold text-black dark:text-white"
                                                                    : isDone
                                                                      ? "opacity-50 italic"
                                                                      : "opacity-60"
                                                            }`}
                                                        >
                                                            {u.username}{isDone
                                                                ? " • uit"
                                                                : ""}{i <
                                                            block.users.length -
                                                                1
                                                                ? ", "
                                                                : ""}
                                                        </span>
                                                    {/each}
                                                </p>
                                            </div>
                                        </div>
                                    {:else if item.type === "last_class"}
                                        <div
                                            class="px-4 py-3 rounded-lg border
                                            bg-emerald-50/50 border-emerald-100
                                            dark:bg-emerald-900/20 dark:border-emerald-500/20"
                                        >
                                            <div
                                                class="flex items-center gap-2"
                                            >
                                                <span
                                                    class="font-mono text-sm font-medium
                                                    text-emerald-900 dark:text-emerald-200"
                                                >
                                                    {formatTime(
                                                        new Date(item.time),
                                                    )}
                                                </span>
                                                <span
                                                    class="text-xs opacity-50 dark:text-emerald-300"
                                                    >• Uittijd</span
                                                >
                                            </div>
                                            <span
                                                class="text-xs block mt-1
                                                text-emerald-800 dark:text-emerald-300"
                                            >
                                                {item.members
                                                    .map((m) => m.username)
                                                    .join(", ")}
                                            </span>
                                        </div>
                                    {/if}
                                {/each}
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    @keyframes gradient-shift {
        0% {
            background-position: 0% 50%;
        }
        50% {
            background-position: 100% 50%;
        }
        100% {
            background-position: 0% 50%;
        }
    }
    @keyframes glow-pulse {
        0%,
        100% {
            box-shadow: 0 0 12px rgba(168, 85, 247, 0.35);
        }
        50% {
            box-shadow: 0 0 30px rgba(236, 72, 153, 0.55);
        }
    }
    @keyframes sparkle {
        0% {
            opacity: 0;
            transform: translateY(8px) scale(0.4) rotate(0deg);
        }
        40% {
            opacity: 1;
        }
        100% {
            opacity: 0;
            transform: translateY(-20px) scale(1) rotate(90deg);
        }
    }
    @keyframes shimmer {
        0% {
            background-position: -200% 0;
        }
        100% {
            background-position: 200% 0;
        }
    }

    .special-border {
        background: linear-gradient(
            120deg,
            #f59e0b,
            #ec4899,
            #8b5cf6,
            #3b82f6,
            #f59e0b
        );
        background-size: 300% 300%;
        animation:
            gradient-shift 5s ease infinite,
            glow-pulse 2.5s ease-in-out infinite;
    }
    .sparkle {
        position: absolute;
        color: #f59e0b;
        pointer-events: none;
        animation: sparkle 2.4s ease-in-out infinite;
    }
    .shimmer-text {
        background: linear-gradient(
            90deg,
            #7c3aed 40%,
            #f59e0b 50%,
            #7c3aed 60%
        );
        background-size: 200% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        animation: shimmer 3s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
        .special-border,
        .sparkle,
        .shimmer-text {
            animation: none;
        }
    }
</style>
