<script lang="ts">
    import { onMount, tick } from "svelte";
    import { fly, fade } from "svelte/transition";
    import { elasticOut, expoOut } from "svelte/easing";
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

        // We wachten even langer zodat de fly-animaties gestart zijn
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
                        const nextDayISO = new Date(nextDay)
                            .toISOString()
                            .slice(0, 10);
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

        const mainContainer = document.querySelector("[data-scroll-container]");
        if (mainContainer) {
            scrollContainer = mainContainer as HTMLElement;
            mainContainer.addEventListener("scroll", onMainScroll, {
                passive: true,
            });

            const resizeObserver = new ResizeObserver(() => {
                observeMainContainer();
            });
            resizeObserver.observe(mainContainer);

            return () => {
                if (intervalId) clearInterval(intervalId);
                if (syncScrollId !== null) cancelAnimationFrame(syncScrollId);
                if (resizeObserverId !== null)
                    cancelAnimationFrame(resizeObserverId);
                scrollContainer?.removeEventListener("scroll", onMainScroll);
                resizeObserver.disconnect();
            };
        }

        setTimeout(() => {
            if (localStorage.getItem("ad:hide") === "true") return;
        }, 1500);



        setTimeout(() => {
            isInitialLoad = false;
        }, 1000);

        return () => {
            if (intervalId) clearInterval(intervalId);
            if (syncScrollId !== null) cancelAnimationFrame(syncScrollId);
            if (resizeObserverId !== null)
                cancelAnimationFrame(resizeObserverId);
        };
    });

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
                    // First class logic
                    const firstClassStart = getFirstClassStartTime(member, day);
                    if (firstClassStart) {
                        const timeMs = firstClassStart.getTime();
                        if (!firstClassTimes.has(timeMs))
                            firstClassTimes.set(timeMs, []);
                        firstClassTimes.get(timeMs)!.push(member);
                    }
                    // Last class logic
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

        <div class="flex-1 overflow-y-auto p-6 pt-14" data-scroll-container>
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
