<script lang="ts">
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";

    import NumberFlow from "@number-flow/svelte";
    import CheckIn from "./component_checkin.svelte";
    import ComponentSessioncompleteoverlay from "./component_sessioncompleteoverlay.svelte";
    import { pb } from "$lib";
    import ComponentRanking from "./component_ranking.svelte";

    import ComponentExtension from "./component_extension.svelte";
    import { cubicOut } from "svelte/easing";

    let image = $state(undefined) as HTMLImageElement | undefined;

    let sessionInterval: ReturnType<typeof setInterval> | undefined;

    let mounted = $state(false);
    let showOverlay = $state(false);
    let finalScore = $state(0);
    let multiplier_used = $state(1);
    let scoreShow = $state(0);
    let context = $state(undefined) as HTMLDivElement | undefined;
    let safeOnlineUsers = $state([]) as any;

    let showLeaderboard = $state(false);
    let otherOnline = $state([]) as any;
    let loggedintextvisible = $state(true);
    let extensiontextvisible = $state(true);
    let extensionConnected = $state(false);
    let showExtensionHint = $state(false);
    let showExtensionInstructions = $state(false);
    let showExtensionUseHint = $state(true);
    let extensionNeedsUpdate = $state(false);
    let showCustomWallpaperChooser = $state(false);
    let showReleaseNotes = $state(false);
    let progressInLearning = $state(0);

    const DB_NAME = "application";
    const DB_VERSION = 3;
    const STORE_NAME = "images";

    let blockedAction = $state({
        visible: false,
        url: "",
    });

    let app = $state({
        running: false,
        user: {
            id: "",
            name: "",
        },
        counter: 0,
        CheckIn: false,
        background: "8.webp",
    });

    let sessionStartedAt = $state<number | null>(null);
    let checkInState = $state({
        active: false as boolean,
        duration: 10 as number,
        startedAt: 0 as number,
        remaining: 10 as number,
    });
    let checkInInterval: ReturnType<typeof setInterval> | undefined;
    let checkInTimeout: ReturnType<typeof setTimeout> | undefined;

    const formatTime = (time: number) => {
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);

        return { h, m, s };
    };

    function syncTimerWithStart() {
        if (!sessionStartedAt) return;

        app.counter = Math.max(
            0,
            Math.floor((Date.now() - sessionStartedAt) / 1000),
        );
    }

    function openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    export async function saveBackgroundFile(file: File): Promise<void> {
        const db = await openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);

            store.put(file, "background");

            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error);
            };
        });
    }

    export async function loadBackgroundFile(): Promise<File | undefined> {
        const db = await openDB();

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get("background");

            req.onsuccess = () => {
                db.close();
                resolve(req.result as File | undefined);
            };
            req.onerror = () => {
                db.close();
                reject(req.error);
            };
        });
    }

    async function saveScore(seconds: number) {
        if (seconds < 15) return 0;

        let multiplier = 1 + 0.1 * (seconds / 60);
        multiplier = Math.min(multiplier, 3);

        let score = Math.floor(seconds * multiplier);

        multiplier_used = Number(multiplier.toFixed(2));

        finalScore = Math.floor(score);
        showOverlay = true;
        scoreShow += score;

        await pb.collection("studyuren").create({
            user: pb.authStore.record!.id,
            duration: seconds,
            score: score,
            date: new Date().toISOString(),
        });

        return score;
    }

    onMount(() => {
        window.SetWallpaper = () => {
            showCustomWallpaperChooser = true;
        };

        let wakeLock: any = null;

        async function keepScreenAwake() {
            try {
                wakeLock = await navigator.wakeLock.request("screen");
            } catch (err) {
                console.error(err);
            }
        }

        document.addEventListener("visibilitychange", () => {
            if (wakeLock !== null && document.visibilityState === "visible") {
                keepScreenAwake();
            }
        });

        app.background = localStorage.getItem("background") || "8.webp";
        if (app.background.endsWith(".webp")) {
            app.background = "/assets/background/" + app.background;
        } else if (app.background === "local") {
            (async () => {
                const file = await loadBackgroundFile();
                if (file) app.background = URL.createObjectURL(file);
            })();
        }

        const hasFocus = () => {
            return (
                document.hasFocus() && document.visibilityState === "visible"
            );
        };

        window.addEventListener("mousemove", () => {
            if (hasFocus()) {
                resolveCheckIn(true);
            }
        });

        document.addEventListener("fullscreenchange", () => {
            if (extensionConnected) return;

            if (!document.fullscreenElement) {
                app.running = false;
            }
        });

        window.addEventListener("blur", () => {
            if (extensionConnected) return;
            app.running = false;
        });

        window.addEventListener("message", (event) => {
            if (event.data.type === "studyuren:website:blocked") {
                blockedAction.visible = true;
                blockedAction.url = event.data.data.url;

                setTimeout(() => {
                    blockedAction.visible = false;
                    blockedAction.url = "";
                }, 5000);
            }

            if (event.data.type === "studyuren:force-stop") {
                console.log("[App] Force stop ontvangen van extensie");
                app.running = false;
            }

            if (event.data.type === "studyuren:session:active") {
                if (checkInState.active) {
                    resolveCheckIn(true);
                } else {
                    scheduleCheckIn();
                }
            }
        });

        (async () => {
            try {
                await pb.collection("users").update(pb.authStore.record!.id, {
                    ping: new Date().toISOString(),
                });

                setInterval(async () => {
                    await pb
                        .collection("users")
                        .update(pb.authStore.record!.id, {
                            ping: new Date().toISOString(),
                        });
                }, 5000);

                otherOnline = await pb.collection("users_public").getFullList({
                    filter: `ping > "${new Date(Date.now() - 10 * 1000).toISOString().replace("T", " ").split(".")[0]}"`,
                });

                await pb.collection("users_public").subscribe("*", async () => {
                    otherOnline = await pb
                        .collection("users_public")
                        .getFullList({
                            filter: `ping > "${new Date(Date.now() - 10 * 1000).toISOString().replace("T", " ").split(".")[0]}"`,
                        });
                });
            } catch (e) {
                console.log("Application crashed with friendNetworkError");
                console.error(e);
            }

            safeOnlineUsers = (otherOnline ?? [])
                .map((o: any) => o?.expand?.user?.expand?.user)
                .filter((u: any) => u && u.id !== app.user.id);
        })();

        (async () => {
            const totalScore = (
                await pb
                    .collection("studyuren_lookup")
                    .getFirstListItem(
                        "user.id = '" + pb.authStore.record!.id + "'",
                    )
            ).all_score;

            app.user.id = pb.authStore.record!.id;
            app.user.name = pb.authStore.record!.username;

            setTimeout(() => {
                scoreShow = totalScore;
            }, 900);
        })();

        setTimeout(() => {
            loggedintextvisible = false;
        }, 2500);

        setTimeout(() => {
            extensiontextvisible = false;
        }, 5000);

        mounted = true;

        // progressInLearning setting
        (async () => {
            const experienceToday = (
                await pb
                    .collection("studyuren_lookup")
                    .getOne(pb.authStore.record?.id!)
            ).daily_score;

            const targetExperience = 5400;

            progressInLearning = Math.min(
                100,
                Math.round((experienceToday / targetExperience) * 100),
            );
        })();

        return () => {
            clearSessionInterval();
            clearCheckInTimeout();
            clearCheckInInterval();
        };
    });

    function clearCheckInInterval() {
        if (checkInInterval) {
            clearInterval(checkInInterval);
            checkInInterval = undefined;
        }
    }

    function clearCheckInTimeout() {
        if (checkInTimeout) {
            clearTimeout(checkInTimeout);
            checkInTimeout = undefined;
        }
    }

    function clearSessionInterval() {
        if (sessionInterval) {
            clearInterval(sessionInterval);
            sessionInterval = undefined;
        }
    }

    function triggerCheckIn(duration = 10) {
        if (checkInState.active) return;

        clearCheckInTimeout();

        const startedAt = Date.now();

        checkInState.active = true;
        checkInState.duration = duration;
        checkInState.startedAt = startedAt;
        checkInState.remaining = duration;
        app.CheckIn = true;

        window.postMessage(
            { type: "studyuren:check-in-start", duration, startedAt },
            "*",
        );

        clearCheckInInterval();
        checkInInterval = setInterval(() => {
            const remaining = Math.max(
                0,
                Math.ceil(duration - (Date.now() - startedAt) / 1000),
            );

            checkInState.remaining = remaining;
            app.CheckIn = checkInState.active;

            if (remaining <= 0) {
                resolveCheckIn(false);
            }
        }, 250);
    }

    function resolveCheckIn(successful: boolean) {
        if (!checkInState.active) {
            return;
        }

        checkInState.active = false;
        app.CheckIn = false;
        checkInState.remaining = checkInState.duration;

        window.postMessage({ type: "studyuren:check-in-end" }, "*");

        clearCheckInInterval();

        if (!successful) {
            app.running = false;
        } else if (app.running) {
            scheduleCheckIn();
        }
    }

    function scheduleCheckIn() {
        if (!app.running) {
            return;
        }

        if (checkInState.active) {
            return;
        }

        clearCheckInTimeout();

        const delay = Math.floor(
            Math.random() * (20 * 60 * 1000 - 5 * 60 * 1000) + 5 * 60 * 1000,
        );
        checkInTimeout = setTimeout(() => {
            if (!app.running) return;
            if (checkInState.active) return;

            const audio = new Audio("/assets/notification.mp3");
            audio.play();
            triggerCheckIn();
        }, delay);
    }

    $effect(() => {
        const running = app.running;

        if (running) {
            startSession();
        } else {
            stopSession();
        }
    });

    function startSession() {
        if (sessionStartedAt) {
            return;
        }

        sessionStartedAt = Date.now();
        app.counter = 0;

        if (!extensionConnected) {
            showExtensionHint = true;
        }
        image?.classList.remove("animate-zoomout-and-unblur");
        image?.classList.add("animate-zoom-and-blur");

        scheduleCheckIn();

        clearSessionInterval();
        sessionInterval = setInterval(() => {
            syncTimerWithStart();
        }, 1000);

        context?.requestFullscreen?.();
        window.postMessage(
            {
                type: "studyuren:start-session",
                startedAt: sessionStartedAt,
            },
            "*",
        );
    }

    function stopSession() {
        const hadSession = Boolean(sessionStartedAt);

        if (sessionStartedAt) {
            syncTimerWithStart();
        }

        if (hadSession) {
            saveScore(app.counter);
        }
        window.postMessage({ type: "studyuren:end-session" }, "*");

        image?.classList.remove("animate-zoom-and-blur");
        image?.classList.add("animate-zoomout-and-unblur");

        clearSessionInterval();
        clearCheckInTimeout();
        clearCheckInInterval();

        app.counter = 0;
        app.CheckIn = false;
        checkInState.active = false;
        checkInState.remaining = checkInState.duration;
        sessionStartedAt = null;

        if (document.fullscreenElement) {
            document.exitFullscreen?.();
        }
    }

    $effect(() => {
        safeOnlineUsers = (otherOnline ?? [])
            .map((o: any) => o?.expand?.user?.expand?.user)
            .filter((u: any) => u && u.id !== app.user.id);
    });
</script>

<ComponentExtension
    bind:extConnected={extensionConnected}
    bind:needsUpdate={extensionNeedsUpdate}
/>

<svelte:head>
    <title>Studyuren - Study</title>
</svelte:head>

{#if mounted}
    <content
        bind:this={context}
        class="bg-black absolute h-full w-full overflow-hidden"
    >
        <img
            bind:this={image}
            src={app.background}
            alt="Background"
            class="object-cover h-full w-full"
        />
        <div
            class="absolute top-0 left-0 h-full w-full z-10 flex flex-col items-center justify-center text-white text-8xl"
        >
            <div
                class="absolute cursor-default mb-8 flex items-center justify-center
                    {app.CheckIn
                    ? 'animate-unnoticed-zoomout'
                    : 'animate-unnoticed-reenter'}"
                style="--progress: {progressInLearning}%"
            >
                <div
                    class="timer-base flex gap-1 justify-center items-center
                        {app.running ? 'fade-out' : 'fade-in'}"
                >
                    {#if formatTime(app.counter)["m"] < 10}0{/if}
                    <NumberFlow value={formatTime(app.counter)["m"]} />
                    :{#if formatTime(app.counter)["s"] < 10}0{/if}
                    <NumberFlow value={formatTime(app.counter)["s"]} />
                </div>

                <div
                    class="timer-fill flex gap-1 items-center
                        {app.running ? 'full-width fade-in' : 'fade-in'}"
                >
                    {#if formatTime(app.counter)["m"] < 10}0{/if}
                    <NumberFlow value={formatTime(app.counter)["m"]} />
                    :{#if formatTime(app.counter)["s"] < 10}0{/if}
                    <NumberFlow value={formatTime(app.counter)["s"]} />
                </div>
            </div>

            <style>
                .timer-base {
                    color: rgba(255, 255, 255, 0.35);
                    transition: opacity 400ms cubic-bezier(0.22, 1, 0.36, 1); /* smooth ease-out */
                }

                .timer-fill {
                    position: absolute;
                    inset: 0;
                    overflow: hidden;
                    white-space: nowrap;

                    width: var(--progress);
                    color: white;
                    pointer-events: none;

                    transition:
                        width 500ms cubic-bezier(0.22, 1, 0.36, 1),
                        opacity 400ms cubic-bezier(0.22, 1, 0.36, 1);
                }

                .full-width {
                    width: 100% !important;
                }

                .fade-in {
                    opacity: 1;
                }

                .fade-out {
                    opacity: 0;
                }
            </style>

            {#if showCustomWallpaperChooser}
                <div
                    transition:fade={{ duration: 400 }}
                    class="fixed inset-0 backdrop-blur-3xl bg-black/30 z-30"
                ></div>

                <div
                    in:fly={{ duration: 500, y: 20, easing: cubicOut }}
                    out:fly={{ duration: 300, y: 10, opacity: 0 }}
                    class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40
					w-[90%] max-w-2xl"
                >
                    <div
                        class="backdrop-blur-2xl bg-white/10 border border-white/20 rounded-3xl shadow-2xl overflow-hidden"
                    >
                        <div class="px-6 py-5 border-b border-white/10">
                            <div class="flex items-center justify-between">
                                <h2 class="text-xl font-semibold text-white/95">
                                    Kies een achtergrond
                                </h2>
                                <button
                                    onclick={() => {
                                        showCustomWallpaperChooser = false;
                                    }}
                                    class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20
										flex items-center justify-center transition-all duration-200
										hover:scale-105 active:scale-95"
                                    aria-label="Close"
                                >
                                    <svg
                                        class="w-4 h-4 text-white/80"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            stroke-linecap="round"
                                            stroke-linejoin="round"
                                            stroke-width="2"
                                            d="M6 18L18 6M6 6l12 12"
                                        />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        <div
                            class="p-6 overflow-y-auto max-h-[60vh] custom-scrollbar"
                        >
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {#each Array(8) as _, i}
                                    <button
                                        onclick={() => {
                                            app.background = i + 1 + ".webp";
                                            localStorage.setItem(
                                                "background",
                                                i + 1 + ".webp",
                                            );
                                            showCustomWallpaperChooser = false;
                                            window.location.reload();
                                        }}
                                        class="group relative aspect-video rounded-2xl overflow-hidden
											ring-2 ring-transparent hover:ring-white/40
											transition-all duration-300 hover:scale-[1.02]
											active:scale-[0.98]"
                                    >
                                        <img
                                            src="/assets/background/{i +
                                                1}.webp"
                                            alt="Wallpaper {i + 1}"
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

                                        {#if app.background === i + 1 + ".webp"}
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
                                    class="group relative aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-white/40
										flex items-center justify-center text-white/80 cursor-pointer hover:border-white/80
										transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] text-sm"
                                >
                                    <input
                                        type="file"
                                        accept="image/*"
                                        class="hidden"
                                        onchange={async (e) => {
                                            const file = (
                                                e.target as HTMLInputElement
                                            ).files?.[0];
                                            if (!file) return;

                                            try {
                                                await saveBackgroundFile(file);
                                                localStorage.setItem(
                                                    "background",
                                                    "local",
                                                );
                                                app.background =
                                                    URL.createObjectURL(file);
                                                showCustomWallpaperChooser = false;
                                            } catch (err) {
                                                console.error(
                                                    "Failed to save background",
                                                    err,
                                                );
                                            }

                                            window.location.reload();
                                        }}
                                    />
                                    <span class="text-center">
                                        Upload custom
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            {/if}

            {#if showExtensionHint}
                <div
                    class="backdrop-blur-xl bg-black/75 absolute top-0 left-0 h-full w-full"
                    transition:fade={{ duration: 500 }}
                ></div>
                <div
                    in:fly={{ duration: 500, y: -10, easing: cubicOut }}
                    out:fly={{ duration: 500, y: 10 }}
                    class="absolute top-[50%] left-[50%] translate-x-[-50%] z-40 translate-y-[-50%] flex flex-col items-center gap-4 px-6 py-8 max-w-md w-full"
                >
                    <div class="flex items-center gap-2 text-white text-2xl">
                        <h1 class="font-semibold">Studyuren Companion</h1>
                    </div>
                    <p class="text-white/50 text-sm text-center">
                        Het lijkt erop dat je Studyuren Companion niet hebt
                        geinstalleerd. Wil je deze installeren? Studyuren
                        Companion laat verschillende websites toe terwijl je
                        beter bent met het studeren.
                    </p>
                    <div class="flex gap-5 items-center justify-center">
                        <button
                            class="text-white/65 hover:text-white cursor-pointer duration-300 text-sm text-center"
                            onclick={() => {
                                app.running = false;
                                showExtensionHint = false;
                                showExtensionInstructions = true;
                            }}
                        >
                            Extensie installeren
                        </button>
                        <button
                            class="text-white/65 hover:text-white cursor-pointer duration-300 text-sm text-center"
                            onclick={() => {
                                showExtensionHint = false;
                            }}
                        >
                            Nee, bedankt.
                        </button>
                    </div>
                </div>
            {/if}

            {#if extensionNeedsUpdate}
                <div
                    class="backdrop-blur-xl bg-black/75 absolute top-0 left-0 h-full w-full"
                    transition:fade={{ duration: 500 }}
                ></div>
                <div
                    in:fly={{ duration: 500, y: -10, easing: cubicOut }}
                    out:fly={{ duration: 500, y: 10 }}
                    class="absolute top-[50%] left-[50%] translate-x-[-50%] z-40 translate-y-[-50%] flex flex-col items-center gap-4 px-6 py-8 max-w-md w-full"
                >
                    <div class="flex items-left gap-2 text-white text-2xl">
                        <h1 class="font-semibold">
                            Extension update beschikbaar
                        </h1>
                    </div>
                    <p class="text-white/50 text-sm text-left">
                        De extension is verouderd. Klik op "Update" om de
                        extensie te updaten.
                    </p>
                    <div class="flex gap-5 items-center justify-center">
                        <button
                            class="text-white/65 hover:text-white cursor-pointer duration-300 text-sm text-center"
                            onclick={() => {
                                showExtensionInstructions = true;
                                extensionNeedsUpdate = false;
                            }}
                        >
                            Update
                        </button>
                        <button
                            class="text-white/65 hover:text-white cursor-pointer duration-300 text-sm text-center"
                            onclick={() => {
                                extensionNeedsUpdate = false;
                            }}
                        >
                            Sluiten
                        </button>
                    </div>
                </div>
            {/if}

            {#if showExtensionInstructions}
                <div
                    class="backdrop-blur-xl bg-black/75 z-999 absolute top-0 left-0 h-full w-full"
                    transition:fade={{ duration: 500 }}
                ></div>
                <div
                    in:fly={{ duration: 500, y: -10, easing: cubicOut }}
                    out:fly={{ duration: 500, y: 10 }}
                    class="absolute top-[50%] left-[50%] translate-x-[-50%] z-999 translate-y-[-50%] flex flex-col items-center gap-4 px-6 py-8 max-w-md w-full"
                >
                    <div class="flex items-left gap-2 text-white text-2xl">
                        <h1 class="font-semibold">
                            Installatie van Studyuren Companion
                        </h1>
                    </div>
                    <p class="text-white/50 text-sm text-left">
                        1. Installeer de zip vanaf deze <a
                            class="underline text-white/70 hover:text-white"
                            href="/assets/download/studyuren-companion.zip"
                        >
                            link
                        </a>.<br /> 2. Klik rechtermuisknop en druk op Alles
                        uitpakken...<br /> 3. Ga naar about://extensions en klik
                        op "Developer mode".<br /> 4. Klik op "Load unpacked"
                        (of "Uitgepakt laden") en selecteer de
                        "studyuren-companion" map.<br /> 5. Je hebt nu de nieuwste
                        versie van Studyuren Companion geinstalleerd!
                    </p>
                    <div class="flex gap-5 items-center justify-center">
                        <button
                            class="text-white/65 hover:text-white cursor-pointer duration-300 text-sm text-center"
                            onclick={() => {
                                window.location.reload();
                            }}
                        >
                            Klaar!
                        </button>
                    </div>
                </div>
            {/if}

            <div class="mt-52">
                {#if checkInState.active}
                    <CheckIn
                        duration={checkInState.duration || 10}
                        remaining={checkInState.remaining}
                        callback={() => resolveCheckIn(false)}
                    />
                {/if}
            </div>

            {#if !app.user.id}
                <p
                    class="text-sm absolute top-16 cursor-pointer duration-200 hover:opacity-100 z-10
				{app.running ? 'opacity-0' : 'opacity-45'}"
                    in:fly={{ duration: 500, y: -5 }}
                >
                    Gebruikersprofiel aan het laden
                </p>
            {:else if loggedintextvisible}
                <p
                    class="text-sm absolute top-16 duration-200
				{app.running ? 'opacity-0' : 'opacity-45'}"
                    in:fly={{ duration: 500, y: -5 }}
                    out:fly={{ duration: 500, y: -5 }}
                >
                    Ingelogd als {app.user.name}
                </p>
            {:else if extensiontextvisible && extensionConnected}
                <div
                    class="text-sm absolute top-16 duration-200 flex gap-2 items-center justify-center
					{app.running ? 'opacity-0' : 'opacity-45'}"
                    in:fly={{ duration: 500, y: -5, delay: 250 }}
                    out:fly={{ duration: 500, y: -5 }}
                >
                    <div
                        class="size-2 bg-emerald-500 rounded-full animate-pulse"
                    ></div>
                    Extension verbonden
                </div>
            {:else if extensionConnected && app.running && (setTimeout(() => (showExtensionUseHint = false), 2500), true) && showExtensionUseHint}
                <div
                    class="text-sm absolute top-16 duration-200 flex gap-2 items-center justify-center
					{app.running ? 'opacity-100' : 'opacity-45'}"
                    in:fly={{ duration: 500, y: -5, delay: 250 }}
                    out:fly={{ duration: 500, y: -5 }}
                >
                    Druk op ESC om je browser te gebruiken
                </div>
            {:else if blockedAction.visible}
                <div
                    class="text-sm absolute top-16 duration-200 flex gap-2 items-center justify-center
					{app.running ? 'opacity-65' : 'opacity-0'}"
                    in:fly={{ duration: 500, y: -5, delay: 250 }}
                    out:fly={{ duration: 500, y: -5 }}
                >
                    <div
                        class="size-2 bg-red-500 rounded-full animate-pulse"
                    ></div>
                    Website geblokkeerd ({new URL(blockedAction.url).hostname})
                </div>
            {:else if safeOnlineUsers.length > 0}
                <div
                    class="text-sm absolute top-16 flex gap-2 items-center justify-center
		cursor-pointer duration-200
		{app.running ? 'opacity-100' : 'opacity-65'}"
                    in:fly={{ duration: 500, y: -5, delay: 250 }}
                    out:fly={{ duration: 500, y: -5 }}
                >
                    <div
                        class="size-2 bg-emerald-500 rounded-full {app.running
                            ? 'animate-pulse'
                            : ''}"
                    ></div>

                    {#if safeOnlineUsers.length === 1}
                        {safeOnlineUsers[0].username} focust
                    {:else}
                        {safeOnlineUsers
                            .slice(0, -1)
                            .map((u: any) => u.username)
                            .join(", ")}
                        en {safeOnlineUsers.slice(-1)[0].username} focussen
                    {/if}
                </div>
            {/if}

            <button
                onclick={() => {
                    showLeaderboard = !showLeaderboard;
                }}
                class="text-sm absolute bottom-30 z-10 cursor-pointer duration-200
				{app.running ? 'opacity-0' : 'opacity-45 hover:opacity-100'}"
                in:fly={{ duration: 500, y: -5, delay: 1000 }}
            >
                <NumberFlow value={scoreShow} /> XP
            </button>

            <button
                onclick={() => {
                    app.running = !app.running;
                }}
                class="text-sm absolute bottom-24 cursor-pointer hover:opacity-100 duration-200 z-10
				{app.running ? 'opacity-25' : 'opacity-45'}"
                in:fly={{ duration: 500, y: 5, delay: 1000 }}
            >
                {app.running
                    ? "Tik ergens om te stoppen"
                    : "Tik ergens om te starten"}
            </button>
            <button
                class="absolute top-0 left-0 h-full w-full opacity-0"
                onclick={() => {
                    app.running = !app.running;
                }}
            >
                Tik om te starten
            </button>

            {#if showLeaderboard}
                <ComponentRanking callback={() => (showLeaderboard = false)} />
            {/if}

            {#if showOverlay}
                <ComponentSessioncompleteoverlay
                    amount={finalScore}
                    callback={() => {
                        showOverlay = false;
                    }}
                    multiplier={multiplier_used}
                />
            {/if}
        </div></content
    >
{/if}

<style>
    :global(.animate-zoom-and-blur) {
        animation: zoom-and-blur 2s cubic-bezier(0.175, 0.885, 0.32, 1.275)
            normal forwards;
    }

    :global(.animate-zoomout-and-unblur) {
        animation: zoomout-and-unblur 1.75s cubic-bezier(0.215, 0.61, 0.1, 1)
            normal forwards;
    }

    :global(.animate-unnoticed-zoomout) {
        animation: zoomout-and-blur 500ms cubic-bezier(0.215, 0.61, 0.355, 1)
            normal forwards;
    }

    :global(.animate-unnoticed-reenter) {
        animation: zoomin-and-unblur 500ms cubic-bezier(0.215, 0.61, 0.355, 1)
            normal forwards;
    }

    @keyframes zoom-and-blur {
        0% {
            transform: scale(1);
        }
        100% {
            transform: scale(1.1);
            filter: blur(10px);
            opacity: 0.9;
        }
    }

    @keyframes zoomout-and-unblur {
        0% {
            transform: scale(1.1);
            filter: blur(10px);
            opacity: 0.9;
        }
        100% {
            transform: scale(1);
            filter: blur(0px);
            opacity: 1;
        }
    }

    @keyframes zoomout-and-blur {
        0% {
            transform: scale(1);
        }
        100% {
            transform: scale(0.8);
            filter: blur(5px);
            opacity: 0.9;
        }
    }

    @keyframes zoomin-and-unblur {
        0% {
            transform: scale(0.8);
            filter: blur(5px);
            opacity: 0.9;
        }
        100% {
            transform: scale(1);
            filter: blur(0px);
            opacity: 1;
        }
    }
</style>
