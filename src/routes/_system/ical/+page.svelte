<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import { fly, fade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import ICAL from "ical.js";
    import { MapPin } from "lucide-svelte";
    import { ChevronLeft, ChevronRight } from "@jis3r/icons";

    interface CalendarEvent {
        summary: string;
        start: Date;
        end: Date;
        location: string;
    }

    let events = $state<CalendarEvent[]>([]);
    let loading = $state(true);
    let error = $state<string | null>(null);
    let viewDate = $state(new Date());
    let mounted = $state(false);

    let startOfWeek = $derived.by(() => {
        const d = new Date(viewDate);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    });

    let weekDays = $derived(
        Array.from({ length: 5 }, (_, i) => {
            const date = new Date(startOfWeek);
            date.setDate(startOfWeek.getDate() + i);
            return date;
        }),
    );

    async function fetchCalendar() {
        const icalUrl = page.url.searchParams.get("url");
        if (!icalUrl) {
            error = "Voeg ?url=[link] toe aan de adresbalk.";
            loading = false;
            return;
        }

        try {
            const response = await fetch(icalUrl);
            const text = await response.text();
            const jcalData = ICAL.parse(text);
            const comp = new ICAL.Component(jcalData);

            const fetchedEvents = comp
                .getAllSubcomponents("vevent")
                .map((vevent) => {
                    const event = new ICAL.Event(vevent);
                    return {
                        summary: event.summary,
                        start: event.startDate.toJSDate(),
                        end: event.endDate.toJSDate(),
                        location: event.location || "",
                    };
                });

            events = fetchedEvents.sort(
                (a, b) => a.start.getTime() - b.start.getTime(),
            );
        } catch (e) {
            error =
                "Kon kalender niet laden. Check de URL of CORS instellingen.";
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        fetchCalendar();
        mounted = true;
    });

    const moveWeek = (days: number) => {
        const d = new Date(viewDate);
        d.setDate(d.getDate() + days);
        viewDate = d;
    };
</script>

{#if mounted}
    <div
        in:fade={{ delay: 1000, duration: 300 }}
        class="h-screen bg-black flex flex-col items-center justify-start p-6 font-sans"
    >
        <div
            in:fly={{ duration: 500, y: -10, easing: cubicOut }}
            class="w-full max-w-5xl flex items-center justify-between mb-6"
        >
            <div>
                <h1 class="text-white text-2xl font-semibold">
                    {startOfWeek.toLocaleDateString("nl-NL", {
                        month: "long",
                        year: "numeric",
                    })}
                </h1>
                <p class="text-white/40 text-sm">
                    Agenda van {page.url.searchParams.get("name")}
                </p>
            </div>

            <div
                class="flex items-center divide-x divide-white/10 rounded-lg border border-white/10 bg-white/5"
            >
                <button
                    onclick={() => moveWeek(-7)}
                    class="p-2 text-white/50 hover:bg-white/5 hover:text-white transition-all rounded-l-lg flex justify-center items-center"
                    title="Vorige week"
                >
                    <ChevronLeft size={18} />
                </button>

                <button
                    onclick={() => (viewDate = new Date())}
                    class="px-4 py-1.5 text-xs font-medium tracking-wide uppercase text-white/50 hover:bg-white/5 hover:text-white transition-all"
                >
                    Vandaag
                </button>

                <button
                    onclick={() => moveWeek(7)}
                    class="p-2 text-white/50 hover:bg-white/5 hover:text-white transition-all rounded-r-lg flex justify-center items-center"
                    title="Volgende week"
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>

        {#if error}
            <p transition:fade class="text-white/50 text-sm mt-20">
                {error}
            </p>
        {:else}
            <div
                in:fly={{ duration: 500, y: 10, easing: cubicOut }}
                class="h-full w-full max-w-5xl grid grid-cols-5 gap-2 overflow-y-auto">
                {#each weekDays as dayDate, i}
                    {@const isToday =
                        dayDate.toDateString() === new Date().toDateString()}
                    {@const dayEvents = events.filter(
                        (e) =>
                            e.start.toDateString() === dayDate.toDateString(),
                    )}

                    <div
                        in:fly={{
                            duration: 400,
                            y: 10,
                            delay: i * 50,
                            easing: cubicOut,
                        }}
                        class="flex flex-col gap-2"
                    >
                        <div class="text-center pb-2 min-h-15">
                            <span
                                class="block text-xs uppercase font-medium text-white/30"
                            >
                                {dayDate.toLocaleDateString("nl-NL", {
                                    weekday: "short",
                                })}
                            </span>
                            <span
                                class="text-lg font-semibold {isToday
                                    ? 'text-white'
                                    : 'text-white/40'}"
                            >
                                {dayDate.getDate()}
                            </span>
                            {#if isToday}
                                <div
                                    class="w-1 h-1 bg-white rounded-full mx-auto mt-0.5"
                                ></div>
                            {/if}
                        </div>

                        <div class="flex flex-col gap-1.5 min-h-50">
                            {#each dayEvents as event}
                                <div
                                    class="p-2.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10 hover:bg-white/15 duration-200"
                                >
                                    <div
                                        class="text-white text-xs font-medium truncate"
                                    >
                                        {event.summary.split("-")[1]}
                                    </div>
                                    <div class="text-white/40 text-xs mt-0.5">
                                        {event.start.toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                        - {event.summary.split("-")[2]}
                                    </div>
                                    {#if event.location}
                                        <div
                                            class="text-white/30 text-xs mt-1 truncate flex gap-1 items-center"
                                        >
                                            <MapPin class="size-3" />
                                            {event.location}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
{/if}
