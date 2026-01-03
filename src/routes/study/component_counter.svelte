<script lang="ts">
    import NumberFlow from "@number-flow/svelte";

    interface CounterProps {
        counter: number;
        running: boolean;
        checkIn: boolean;
        progressInLearning: number;
        mode?: "normal" | "pomodoro";
        strictnessSettings?: {
            browserFocus: boolean;
            tabManagement: boolean;
            checkInMoments: boolean;
        };
        onPhaseComplete?: (phase: "work" | "shortBreak" | "longBreak") => void;
    }

    let {
        counter = $bindable(0),
        running = false,
        checkIn = false,
        progressInLearning = 0,
        mode = "normal",
        strictnessSettings = {
            browserFocus: true,
            tabManagement: true,
            checkInMoments: true,
        },
        onPhaseComplete,
    }: CounterProps = $props();

    const POMODORO_WORK = 25 * 60;
    const POMODORO_SHORT_BREAK = 5 * 60;
    const POMODORO_LONG_BREAK = 15 * 60;

    let pomodoroPhase = $state<"work" | "shortBreak" | "longBreak">("work");
    let pomodoroSession = $state(1);
    let phaseStartCounter = $state(0);

    $effect(() => {
        if (mode === "pomodoro" && running) {
            const phaseDuration =
                pomodoroPhase === "work"
                    ? POMODORO_WORK
                    : pomodoroPhase === "shortBreak"
                      ? POMODORO_SHORT_BREAK
                      : POMODORO_LONG_BREAK;

            const elapsed = counter - phaseStartCounter;

            if (elapsed >= phaseDuration) {
                const completedPhase = pomodoroPhase;
                phaseStartCounter = counter;

                if (pomodoroPhase === "work") {
                    if (pomodoroSession % 4 === 0) {
                        pomodoroPhase = "longBreak";
                    } else {
                        pomodoroPhase = "shortBreak";
                    }
                } else {
                    pomodoroPhase = "work";
                    pomodoroSession += 1;
                    onPhaseComplete?.(completedPhase);
                }
            }
        }
    });

    let displayTime = $derived(() => {
        if (mode === "pomodoro") {
            const maxTime =
                pomodoroPhase === "work"
                    ? POMODORO_WORK
                    : pomodoroPhase === "shortBreak"
                      ? POMODORO_SHORT_BREAK
                      : POMODORO_LONG_BREAK;
            const elapsed = counter - phaseStartCounter;
            return Math.max(0, maxTime - elapsed);
        }
        return counter;
    });

    const formatTime = (time: number) => {
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);
        return { h, m, s };
    };

    let xpMultiplier = $derived(() => {
        let multiplier = 1.0;
        if (!strictnessSettings.browserFocus) multiplier -= 0.1;
        if (!strictnessSettings.tabManagement) multiplier -= 0.1;
        if (!strictnessSettings.checkInMoments) multiplier -= 0.1;
        return Math.max(0.1, multiplier);
    });

    let calculatedXP = $derived(() => {
        if (mode === "pomodoro" && pomodoroPhase !== "work") {
            return 0;
        }
        return Math.floor(counter * xpMultiplier());
    });

    let pomodoroProgress = $derived(() => {
        if (mode === "pomodoro") {
            const phaseDuration =
                pomodoroPhase === "work"
                    ? POMODORO_WORK
                    : pomodoroPhase === "shortBreak"
                      ? POMODORO_SHORT_BREAK
                      : POMODORO_LONG_BREAK;
            const elapsed = counter - phaseStartCounter;
            return Math.min(100, (elapsed / phaseDuration) * 100);
        }
        return progressInLearning;
    });
</script>

<div
    class="absolute cursor-default mb-8 flex flex-col items-center justify-center
        {checkIn ? 'animate-unnoticed-zoomout' : 'animate-unnoticed-reenter'}"
    style="--progress: {progressInLearning}%"
>
    {#if mode === "pomodoro"}
        <div
            class="text-sm uppercase -mb-3 font-medium tracking-wider text-white/50"
        >
            {#if pomodoroPhase === "work"}
                Studeren
            {:else}
                Pauze
            {/if}
        </div>
    {/if}

    <div
        class="timer-base flex gap-1 justify-center items-center
            {running ? 'fade-out' : 'fade-in'}"
    >
        {#if formatTime(displayTime())["m"] < 10}0{/if}
        <NumberFlow value={formatTime(displayTime())["m"]} />
        :{#if formatTime(displayTime())["s"] < 10}0{/if}
        <NumberFlow value={formatTime(displayTime())["s"]} />
    </div>

    <div
        class="timer-fill flex gap-1 items-center
            {running ? 'full-width fade-in' : 'fade-in'}"
    >
        {#if formatTime(displayTime())["m"] < 10}0{/if}
        <NumberFlow value={formatTime(displayTime())["m"]} />
        :{#if formatTime(displayTime())["s"] < 10}0{/if}
        <NumberFlow value={formatTime(displayTime())["s"]} />
    </div>
</div>

<style>
    .timer-base {
        color: rgba(255, 255, 255, 0.35);
        transition: opacity 400ms cubic-bezier(0.22, 1, 0.36, 1);
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
