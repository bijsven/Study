<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { X, Info } from "lucide-svelte";
    import { pb } from "@/index";

    interface StrictnessSettings {
        browserFocus: boolean;
        tabManagement: boolean;
        checkInMoments: boolean;
    }

    interface SettingsProps {
        onClose: () => void;
        currentBackground: string;
        onBackgroundChange: (background: string) => void;
        counterMode?: "normal" | "pomodoro";
        onCounterModeChange?: (mode: "normal" | "pomodoro") => void;
        strictnessSettings?: StrictnessSettings;
        onStrictnessChange?: (settings: StrictnessSettings) => void;
    }

    let {
        onClose,
        currentBackground = $bindable("8.webp"),
        onBackgroundChange,
        counterMode = $bindable("normal"),
        onCounterModeChange,
        strictnessSettings = $bindable({
            browserFocus: true,
            tabManagement: true,
            checkInMoments: true,
        }),
        onStrictnessChange,
    }: SettingsProps = $props();

    let imagesLoaded = $state<Record<number, boolean>>({});
    let activeTab = $state<
        "backgrounds" | "counter" | "general" | "strictness"
    >("general");

    // Calculate XP boost multiplier based on strictness settings
    let xpBoostMultiplier = $derived(() => {
        let multiplier = 1.0;
        if (!strictnessSettings.browserFocus) multiplier -= 0.3;
        if (!strictnessSettings.tabManagement) multiplier -= 0.3;
        if (!strictnessSettings.checkInMoments) multiplier -= 0.3;
        return Math.max(0.1, multiplier); // Minimum 0.1x multiplier
    });

    let previousMultiplier = $state(1.0);
    let animateMultiplier = $state(false);

    // Watch for multiplier changes and trigger animation
    $effect(() => {
        const current = xpBoostMultiplier();
        if (current !== previousMultiplier) {
            animateMultiplier = true;
            setTimeout(() => {
                animateMultiplier = false;
                previousMultiplier = current;
            }, 500);
        }
    });

    function handleStrictnessChange(
        key: keyof StrictnessSettings,
        value: boolean,
    ) {
        const newSettings = { ...strictnessSettings, [key]: value };
        strictnessSettings = newSettings;
        onStrictnessChange?.(newSettings);

        // Save to localStorage
        localStorage.setItem("strictnessSettings", JSON.stringify(newSettings));
    }

    const backgrounds = Array.from({ length: 8 }, (_, i) => ({
        id: i + 1,
        thumbnail: `/assets/background/thumbnails/${i + 1}.webp`,
        full: `${i + 1}.webp`,
    }));

    function handleBackgroundSelect(background: string) {
        onBackgroundChange(background);
    }

    async function handleCustomBackground(event: Event) {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (file) {
            try {
                // Save to IndexedDB via parent component
                const reader = new FileReader();
                reader.onload = () => {
                    onBackgroundChange("local");
                };
                reader.readAsDataURL(file);

                // Trigger parent's save function
                if (window.saveBackgroundFile) {
                    await window.saveBackgroundFile(file);
                }
            } catch (error) {
                console.error("Failed to save custom background:", error);
            }
        }
    }

    function handleImageLoad(index: number) {
        imagesLoaded[index] = true;
    }
</script>

<div
    role="button"
    tabindex="0"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
    in:fade={{ duration: 300 }}
    out:fade={{ duration: 200 }}
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md"
>
    <div
        role="dialog"
        tabindex="0"
        onclick={(e) => e.stopPropagation()}
        onkeydown={(e) => e.stopPropagation()}
        in:fly={{ duration: 400, y: 20, easing: cubicOut }}
        out:fly={{ duration: 300, y: 20, opacity: 0 }}
        class="relative w-full max-w-3xl h-[60%] bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
    >
        <div class="px-6 py-5 border-b border-white/10 shrink-0">
            <div class="flex items-center justify-between">
                <h2 class="text-xl font-semibold text-white/95">
                    Instellingen
                </h2>
                <button
                    onclick={onClose}
                    class="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    aria-label="Close settings"
                >
                    <X class="w-5 h-5 text-white/70" />
                </button>
            </div>

            <div class="flex gap-2 mt-4">
                <button
                    onclick={() => (activeTab = "general")}
                    class="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-all cursor-pointer {activeTab ===
                    'general'
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/70'}"
                >
                    Algemeen
                </button>
                <button
                    onclick={() => (activeTab = "strictness")}
                    class="px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/5 transition-all cursor-pointer {activeTab ===
                    'strictness'
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/70'}"
                >
                    Strictheid
                </button>
                <button
                    onclick={() => (activeTab = "backgrounds")}
                    class="px-4 py-2 rounded-lg text-sm cursor-pointer hover:bg-white/5 font-medium transition-all {activeTab ===
                    'backgrounds'
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/70'}"
                >
                    Achtergrond
                </button>
                <button
                    onclick={() => (activeTab = "counter")}
                    class="px-4 py-2 rounded-lg cursor-pointer hover:bg-white/5 text-sm font-medium transition-all {activeTab ===
                    'counter'
                        ? 'bg-white/10 text-white'
                        : 'text-white/50 hover:text-white/70'}"
                >
                    Timer
                </button>
            </div>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
            {#if activeTab === "backgrounds"}
                <div class="space-y-4">
                    <div
                        class="p-2 overflow-y-auto max-h-[60vh] custom-scrollbar"
                    >
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {#each backgrounds as bg (bg.id)}
                                <button
                                    in:fly|global={{
                                        duration: 300,
                                        y: 5,
                                        delay: 50 * bg.id,
                                    }}
                                    onclick={() => {
                                        onBackgroundChange(bg.full);
                                        localStorage.setItem(
                                            "background",
                                            bg.id + ".webp",
                                        );
                                    }}
                                    class="group relative aspect-video rounded-2xl overflow-hidden
											ring-2 ring-transparent hover:ring-white/40
											transition-all duration-300 hover:scale-[1.02]
											active:scale-[0.98]"
                                >
                                    <img
                                        src={bg.thumbnail}
                                        alt="Wallpaper {bg.id}"
                                        loading="lazy"
                                        class="w-full h-full object-cover"
                                    />

                                    <div
                                        class="absolute inset-0 from-black/50 to-transparent
													opacity-0 group-hover:opacity-100 transition-opacity duration-300
													flex items-end justify-center pb-3"
                                    >
                                        <span
                                            class="text-xs font-medium text-white/90 backdrop-blur-sm
													bg-white/20 px-3 py-1 rounded-full"
                                        >
                                            Select
                                        </span>
                                    </div>

                                    {#if currentBackground == bg.full}
                                        <div
                                            class="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/90
													flex items-center justify-center shadow-lg"
                                        >
                                            <svg
                                                class="w-4 h-4 text-black"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fill-rule="evenodd"
                                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                    clip-rule="evenodd"
                                                />
                                            </svg>
                                        </div>
                                    {/if}
                                </button>
                            {/each}

                            <label
                                in:fly|global={{
                                    duration: 150,
                                    y: 5,
                                    delay: 450,
                                }}
                                class="group relative aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-white/40
										flex items-center justify-center text-white/80 cursor-pointer hover:border-white/80
										transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm"
                            >
                                <input
                                    type="file"
                                    accept="image/*"
                                    class="hidden"
                                    onchange={handleCustomBackground}
                                />
                                <span class="text-center"> Upload custom </span>
                            </label>
                        </div>
                    </div>
                </div>
            {:else if activeTab === "counter"}
                <div in:fly={{ y: 5, duration: 300 }} class="space-y-6">
                    <div>
                        <h3 class="text-white/80 text-sm font-medium mb-3">
                            Timer weergave
                        </h3>
                        <div class="space-y-2">
                            <label
                                class="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-all {counterMode ===
                                'normal'
                                    ? 'bg-white/10 border-blue-500'
                                    : ''}"
                            >
                                <input
                                    type="radio"
                                    name="counterMode"
                                    value="normal"
                                    checked={counterMode === "normal"}
                                    onchange={() =>
                                        onCounterModeChange?.("normal")}
                                    class="w-4 h-4 text-blue-500"
                                />
                                <div class="flex-1">
                                    <div
                                        class="text-white font-medium text-base"
                                    >
                                        Standaard
                                    </div>
                                    <div class="text-white/50 text-sm">
                                        Tel omhoog vanaf nul
                                    </div>
                                </div>
                            </label>

                            <!-- <label
                                class="flex items-center gap-3 p-4 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-all {counterMode ===
                                'pomodoro'
                                    ? 'bg-white/10 border-blue-500'
                                    : ''}"
                            >
                                <input
                                    type="radio"
                                    name="counterMode"
                                    value="pomodoro"
                                    checked={counterMode === "pomodoro"}
                                    onchange={() =>
                                        onCounterModeChange?.("pomodoro")}
                                    class="w-4 h-4 text-blue-500"
                                />
                                <div class="flex-1">
                                    <div
                                        class="text-white font-medium text-base"
                                    >
                                        Pomodoro Timer
                                    </div>
                                    <div class="text-white/50 text-sm">
                                        25 min focus, 5 min pauze
                                    </div>
                                </div>
                            </label> -->
                        </div>
                    </div>

                    {#if counterMode === "pomodoro"}
                        <div
                            in:fly={{ duration: 300, y: -10 }}
                            class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                        >
                            <div class="text-white/90 text-sm space-y-2">
                                <p class="font-medium">
                                    Pomodoro instellingen:
                                </p>
                                <ul class="text-white/70 space-y-1 text-xs">
                                    <li>• 25 minuten focus tijd</li>
                                    <li>• 5 minuten korte pauze</li>
                                    <li>
                                        • 15 minuten lange pauze na 4 sessies
                                    </li>
                                </ul>
                            </div>
                        </div>
                    {/if}
                </div>
            {:else if activeTab === "strictness"}
                <div in:fly={{ y: 5, duration: 300 }} class="space-y-6">
                    <div class="space-y-3">
                        <h3 class="text-white/80 text-sm font-medium mb-3">
                            Monitoring Instellingen
                        </h3>

                        <label
                            class="flex items-start gap-4 p-4 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-all {strictnessSettings.browserFocus
                                ? 'bg-white/5'
                                : 'bg-red-500/5 border-red-500/20'}"
                        >
                            <div class="flex items-center h-6">
                                <input
                                    type="checkbox"
                                    checked={strictnessSettings.browserFocus}
                                    onchange={(e) =>
                                        handleStrictnessChange(
                                            "browserFocus",
                                            e.currentTarget.checked,
                                        )}
                                    class="w-5 h-5 rounded accent-blue-500 cursor-pointer"
                                />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="text-white font-medium text-base"
                                    >
                                        Browser Focus Vereist
                                    </span>
                                    {#if !strictnessSettings.browserFocus}
                                        <span
                                            class="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full"
                                        >
                                            −0.3x XP
                                        </span>
                                    {/if}
                                </div>
                                <p class="text-white/60 text-sm mt-1">
                                    {#if strictnessSettings.browserFocus}
                                        De browser moet gefocust blijven.
                                        Switching naar andere apps stopt de
                                        sessie.
                                    {:else}
                                        Je mag vrij tussen apps wisselen.
                                        Check-ins blijven wel actief voor
                                        verificatie.
                                    {/if}
                                </p>
                            </div>
                        </label>

                        <!-- Tab Management Check -->
                        <label
                            class="flex items-start gap-4 p-4 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-all {strictnessSettings.tabManagement
                                ? 'bg-white/5'
                                : 'bg-red-500/5 border-red-500/20'}"
                        >
                            <div class="flex items-center h-6">
                                <input
                                    type="checkbox"
                                    checked={strictnessSettings.tabManagement}
                                    onchange={(e) =>
                                        handleStrictnessChange(
                                            "tabManagement",
                                            e.currentTarget.checked,
                                        )}
                                    class="w-5 h-5 rounded accent-blue-500 cursor-pointer"
                                />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="text-white font-medium text-base"
                                    >
                                        Browser Tabs Beheren
                                    </span>
                                    {#if !strictnessSettings.tabManagement}
                                        <span
                                            class="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full"
                                        >
                                            −0.3x XP
                                        </span>
                                    {/if}
                                </div>
                                <p class="text-white/60 text-sm mt-1">
                                    {#if strictnessSettings.tabManagement}
                                        Alleen toegestane websites (itslearning,
                                        SOMtoday, etc.) zijn toegestaan. Andere
                                        tabs worden gesloten.
                                    {:else}
                                        Alle websites zijn toegestaan. Handig
                                        voor research en opzoekwerk.
                                    {/if}
                                </p>
                            </div>
                        </label>

                        <!-- Check-in Moments -->
                        <label
                            class="flex items-start gap-4 p-4 rounded-lg border border-white/10 hover:bg-white/5 cursor-pointer transition-all {strictnessSettings.checkInMoments
                                ? 'bg-white/5'
                                : 'bg-red-500/5 border-red-500/20'}"
                        >
                            <div class="flex items-center h-6">
                                <input
                                    type="checkbox"
                                    checked={strictnessSettings.checkInMoments}
                                    onchange={(e) =>
                                        handleStrictnessChange(
                                            "checkInMoments",
                                            e.currentTarget.checked,
                                        )}
                                    class="w-5 h-5 rounded accent-blue-500 cursor-pointer"
                                />
                            </div>
                            <div class="flex-1">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="text-white font-medium text-base"
                                    >
                                        Regelmatige Check-in Momenten
                                    </span>
                                    {#if !strictnessSettings.checkInMoments}
                                        <span
                                            class="text-xs px-2 py-0.5 bg-red-500/20 text-red-300 rounded-full"
                                        >
                                            −0.3x XP
                                        </span>
                                    {/if}
                                </div>
                                <p class="text-white/60 text-sm mt-1">
                                    {#if strictnessSettings.checkInMoments}
                                        Om de 5-20 minuten moet je met je muis
                                        bewegen om je aanwezigheid te
                                        bevestigen.
                                    {:else}
                                        Minder frequente check-ins (om de 20-40
                                        minuten) voor flexibeler werken.
                                    {/if}
                                </p>
                            </div>
                        </label>
                    </div>

                    <!-- Extension Info -->
                    <div
                        class="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                    >
                        <div class="flex gap-3">
                            <Info
                                class="w-5 h-5 text-blue-400 shrink-0 mt-0.5"
                            />
                            <div class="text-sm text-white/80 space-y-2">
                                <p class="font-medium text-blue-200">
                                    Chrome Extension Support
                                </p>
                                <p class="text-white/70 leading-relaxed">
                                    Met de <strong>Studyuren Companion</strong>
                                    extension worden check-ins getoond op alle tabs
                                    en wordt tab-beheer geactiveerd. Zonder extension
                                    werken check-ins alleen op dit tab.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            {:else if activeTab === "general"}
                <div in:fly={{ y: 5, duration: 300 }} class="space-y-4">
                    <div
                        class="p-4 bg-white/5 flex justify-between items-center rounded-lg"
                    >
                        <div>
                            <h3 class="text-white/80 text-sm font-medium mb-2">
                                Calendar intergratie
                            </h3>
                            <p class="text-white/50 text-sm">
                                Verbind je agenda met Studyuren om je
                                gestudeerde uren in te kunnen zien in je agenda.
                            </p>
                        </div>

                        <button
                            onclick={async (e) => {
                                let token;

                                const record = await pb
                                    .collection("intergration")
                                    .getFirstListItem(
                                        `user.id='${pb.authStore.record?.id}'`,
                                    );

                                if (record.id)
                                    token = await pb
                                        .collection("intergration")
                                        .delete(record.id);

                                token = await pb
                                    .collection("intergration")
                                    .create({
                                        user: pb.authStore.record?.id,
                                    });

                                const calendar_url =
                                    window.location.origin +
                                    "/study/calendar_intergration?apptoken=" +
                                    token.id;

                                navigator.clipboard.writeText(calendar_url);

                                alert("Agenda URL is gekopieërd!");
                            }}
                            class="p-2 rounded-lg hover:bg-white/10 transition-all text-sm text-nowrap px-3 cursor-pointer active:scale-99"
                        >
                            Genereer agenda-url
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    /* Custom scrollbar */
    :global(.overflow-y-auto) {
        scrollbar-width: thin;
        scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
    }

    :global(.overflow-y-auto::-webkit-scrollbar) {
        width: 8px;
    }

    :global(.overflow-y-auto::-webkit-scrollbar-track) {
        background: rgba(255, 255, 255, 0.05);
    }

    :global(.overflow-y-auto::-webkit-scrollbar-thumb) {
        background: rgba(255, 255, 255, 0.2);
        border-radius: 4px;
    }
</style>
