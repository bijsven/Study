<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { X } from "lucide-svelte";

    interface SettingsProps {
        onClose: () => void;
        currentBackground: string;
        onBackgroundChange: (background: string) => void;
        counterMode?: "normal" | "pomodoro";
        onCounterModeChange?: (mode: "normal" | "pomodoro") => void;
    }

    let {
        onClose,
        currentBackground = $bindable("8.webp"),
        onBackgroundChange,
        counterMode = $bindable("normal"),
        onCounterModeChange,
    }: SettingsProps = $props();

    let imagesLoaded = $state<Record<number, boolean>>({});
    let activeTab = $state<"backgrounds" | "counter" | "general">("general");

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
            {:else if activeTab === "general"}
                <div in:fly={{ y: 5, duration: 300 }} class="space-y-4">
                    <div class="p-4 bg-white/5 rounded-lg">
                        <h3 class="text-white/80 text-sm font-medium mb-2">
                            Algemene instellingen
                        </h3>
                        <p class="text-white/50 text-sm">
                            Meer opties komen binnenkort beschikbaar...
                        </p>
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
