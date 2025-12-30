<script lang="ts">
    import NumberFlow from "@number-flow/svelte";
    import { fade, fly } from "svelte/transition";

    interface CounterProps {
        counter: number;
        mode?: "normal" | "pomodoro";
        isRunning?: boolean;
    }

    let {
        counter = $bindable(0),
        mode = "normal",
        isRunning = false,
    }: CounterProps = $props();

    const formatTime = (time: number) => {
        const h = Math.floor(time / 3600);
        const m = Math.floor((time % 3600) / 60);
        const s = Math.floor(time % 60);
        return { h, m, s };
    };

    const pomodoroSettings = {
        workDuration: 25 * 60, // 25 minutes
        breakDuration: 5 * 60, // 5 minutes
        longBreakDuration: 15 * 60, // 15 minutes
        sessionsUntilLongBreak: 4,
    };

    let pomodoroState = $state({
        currentSession: 0,
        isBreak: false,
        phase: "work" as "work" | "break" | "longBreak",
    });

    // Calculate Pomodoro progress
    $effect(() => {
        if (mode === "pomodoro" && isRunning) {
            const currentDuration =
                pomodoroState.phase === "work"
                    ? pomodoroSettings.workDuration
                    : pomodoroState.phase === "break"
                      ? pomodoroSettings.breakDuration
                      : pomodoroSettings.longBreakDuration;

            if (counter >= currentDuration) {
                // Switch phases
                if (pomodoroState.phase === "work") {
                    pomodoroState.currentSession++;
                    if (
                        pomodoroState.currentSession %
                            pomodoroSettings.sessionsUntilLongBreak ===
                        0
                    ) {
                        pomodoroState.phase = "longBreak";
                    } else {
                        pomodoroState.phase = "break";
                    }
                } else {
                    pomodoroState.phase = "work";
                }
            }
        }
    });

    const getDisplayTime = (time: number) => {
        if (mode === "pomodoro") {
            const currentDuration =
                pomodoroState.phase === "work"
                    ? pomodoroSettings.workDuration
                    : pomodoroState.phase === "break"
                      ? pomodoroSettings.breakDuration
                      : pomodoroSettings.longBreakDuration;

            return formatTime(Math.max(0, currentDuration - time));
        }
        return formatTime(time);
    };

    const getPhaseLabel = () => {
        if (mode !== "pomodoro") return "";

        switch (pomodoroState.phase) {
            case "work":
                return "Focus Time";
            case "break":
                return "Short Break";
            case "longBreak":
                return "Long Break";
        }
    };

    const getProgressPercentage = () => {
        if (mode !== "pomodoro") return (counter / 3600) * 100; // 1 hour max for normal mode

        const currentDuration =
            pomodoroState.phase === "work"
                ? pomodoroSettings.workDuration
                : pomodoroState.phase === "break"
                  ? pomodoroSettings.breakDuration
                  : pomodoroSettings.longBreakDuration;

        return Math.min(100, (counter / currentDuration) * 100);
    };
</script>

<div class="relative flex flex-col items-center gap-4">
    {#if mode === "pomodoro"}
        <div
            class="text-white/60 text-sm font-medium tracking-wide uppercase"
            in:fade={{ duration: 300 }}
        >
            {getPhaseLabel()}
        </div>
        <div class="flex items-center gap-2 text-white/40 text-xs">
            <span>Session {pomodoroState.currentSession + 1}</span>
            <span>•</span>
            <span
                >{pomodoroSettings.sessionsUntilLongBreak -
                    (pomodoroState.currentSession %
                        pomodoroSettings.sessionsUntilLongBreak)} until long break</span
            >
        </div>
    {/if}

    <div
        class="timer-display flex items-center justify-center gap-3 text-white"
    >
        {#if getDisplayTime(counter).h > 0}
            <div class="timer-segment">
                {#if getDisplayTime(counter).h < 10}
                    <span class="timer-zero">0</span>
                {/if}
                <NumberFlow
                    value={getDisplayTime(counter).h}
                    class="timer-value"
                />
                <span class="timer-label">h</span>
            </div>
            <span class="timer-separator">:</span>
        {/if}

        <div class="timer-segment">
            {#if getDisplayTime(counter).m < 10}
                <span class="timer-zero">0</span>
            {/if}
            <NumberFlow value={getDisplayTime(counter).m} class="timer-value" />
            <span class="timer-label">m</span>
        </div>

        <span class="timer-separator">:</span>

        <div class="timer-segment">
            {#if getDisplayTime(counter).s < 10}
                <span class="timer-zero">0</span>
            {/if}
            <NumberFlow value={getDisplayTime(counter).s} class="timer-value" />
            <span class="timer-label">s</span>
        </div>
    </div>

    {#if mode === "pomodoro"}
        <div
            class="w-full max-w-xs h-2 bg-white/10 rounded-full overflow-hidden"
        >
            <div
                class="h-full transition-all duration-1000 ease-linear {pomodoroState.phase ===
                'work'
                    ? 'bg-blue-500'
                    : 'bg-green-500'}"
                style="width: {getProgressPercentage()}%"
            ></div>
        </div>
    {/if}
</div>

<style>
    .timer-display {
        font-size: 6rem;
        font-weight: 700;
        line-height: 1;
        text-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    }

    .timer-segment {
        display: inline-flex;
        align-items: baseline;
        gap: 0.25rem;
        position: relative;
    }

    :global(.timer-value) {
        font-variant-numeric: tabular-nums;
    }

    .timer-zero {
        opacity: 0.5;
    }

    .timer-label {
        font-size: 2rem;
        opacity: 0.4;
        margin-left: 0.25rem;
    }

    .timer-separator {
        opacity: 0.6;
        animation: blink 2s ease-in-out infinite;
    }

    @keyframes blink {
        0%,
        49%,
        100% {
            opacity: 0.6;
        }
        50%,
        99% {
            opacity: 0.2;
        }
    }

    @media (max-width: 768px) {
        .timer-display {
            font-size: 4rem;
        }

        .timer-label {
            font-size: 1.5rem;
        }
    }

    @media (max-width: 480px) {
        .timer-display {
            font-size: 3rem;
        }

        .timer-label {
            font-size: 1rem;
        }
    }
</style>
