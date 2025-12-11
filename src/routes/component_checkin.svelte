<script lang="ts">
	import { onDestroy, onMount, unmount } from "svelte";
	import { fly } from "svelte/transition";

	const duration = 10;
	const radius = 20;
	const circumference = 2 * Math.PI * radius;

	const { callback } = $props();

	let interval: number | undefined;

	let counter = $state(duration);
	let offset = $state(0);

	onMount(() => {
		interval = setInterval(() => {
			counter--;

			if (counter <= 0) {
				clearInterval(interval);
				setTimeout(() => {
					callback();
				}, 1000);
			}
		}, 1000);
	});

	onDestroy(() => {
		clearInterval(interval);
		counter = duration;
		offset = 0;
	});

	$effect(() => {
		const progress = counter / duration;
		offset = circumference * (1 - progress);
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
			style="transition: stroke-dashoffset 1s linear;"
		/>
	</svg>
</div>

<style>
	svg {
		transform: rotate(-90deg);
	}
</style>
