<script lang="ts">
	import { fly } from "svelte/transition";

	const defaultDuration = 10;
	const radius = 20;
	const circumference = 2 * Math.PI * radius;

	const {
		callback,
		remaining = $bindable(),
		duration: incomingDuration,
	} = $props();

	let offset = $state(0);
	let hasCompleted = $state(false);

	$effect(() => {
		const safeDuration = incomingDuration;
		const progress = Math.max(0, Math.min(remaining / safeDuration, 1));
		offset = circumference * (1 - progress);

		if (remaining <= 0 && !hasCompleted) {
			hasCompleted = true;
			setTimeout(() => callback?.(), 250);
		}

		if (remaining > 0) {
			hasCompleted = false;
		}
	});
</script>

<div
	class="text-sm -mt-6 flex justify-between items-center w-96 p-4 h-24 bg-white/10 backdrop-blur-xl"
	style="corner-shape: squircle; border-radius: 40px;"
	transition:fly={{ duration: 500, y: 20 }}
>
	<div>
		<p class="text-xs opacity-45">Ben je er nog?</p>
		<p class="w-64 text-xs">
			Beweeg met je muis om door te gaan, zonder interactie stopt de
			sessie.
		</p>
	</div>

	<svg width="50" height="50" class="ml-4 scale-75">
		<circle
			r={radius}
			cx="25"
			cy="25"
			stroke="white"
			stroke-width="4"
			opacity="0.15"
			fill="none"
		/>

		<circle
			r={radius}
			cx="25"
			cy="25"
			stroke="white"
			stroke-width="4"
			fill="none"
			stroke-dasharray={circumference}
			stroke-dashoffset={offset}
			stroke-linecap="round"
			style="transition: stroke-dashoffset 0.5s linear;"
		/>
	</svg>
</div>

<style>
	svg {
		transform: rotate(-90deg);
	}
</style>
