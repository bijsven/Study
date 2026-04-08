<script>
    import { fade, fly } from "svelte/transition";
</script>

<div
    out:fade
    class="flex justify-center absolute items-center z-50 h-full w-full bg-white dark:bg-zinc-950 duration-300"
>
    <div>
        <h1
            in:fly={{ duration: 500, y: 20 }}
            out:fly={{ duration: 500, y: -20, delay: 250 }}
            class="text-3xl font-semibold text-black dark:text-white falt"
        >
            Tussenuren
        </h1>
        <p
            in:fly={{ duration: 500, y: 10, delay: 250 }}
            out:fly={{ duration: 500, y: -10 }}
            class="falt text-right opacity-65 text-xs text-black dark:text-zinc-400"
        >
            een app bijsven
        </p>
    </div>
</div>
