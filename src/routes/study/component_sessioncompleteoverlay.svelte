<script lang="ts">
    import Zap from "@lucide/svelte/icons/zap";
    import { cubicOut } from "svelte/easing";
    import { fly } from "svelte/transition";

    import NumberFlow from "@number-flow/svelte";
    import { onMount } from "svelte";

	const { amount, multiplier, callback } = $props();

    let amountVisible = $state(0);

    onMount(() => {
        setTimeout(() => {
            amountVisible = amount;
        }, 350);
    });
</script>

<button
    onclick={() => {
        callback();
    }}
    in:fly={{ duration: 650, y: -10, easing: cubicOut }}
    out:fly={{ duration: 450, y: 25 }}
    class="absolute top-0 left-0 h-full w-full flex z-50 bg-black/30 flex-col backdrop-blur-xl justify-center items-center gap-2 cursor-pointer"
>
	<div class="flex justify-center items-center gap-2 text-amber-300 text-2xl">
		<Zap fill="oklch(87.9% 0.169 91.605)" />
		<NumberFlow value={amountVisible} />
	</div>
	<div
		class="absolute bottom-24 flex justify-center items-center flex-col text-center -mt-2"
	>
		<p class="text-sm w-72 text-white/65">
			Je hebt in totaal {Math.floor(amount / multiplier)} seconden gestudeerd, en je hebt
een multiplier van ${multiplier.toFixed(2)} gekregen.
		</p>
		<span class="text-white/30 text-sm text-nowrap mt-3">
			XP wordt berekent door de tijd en een multiplier.
		</span>
	</div>
</button>
