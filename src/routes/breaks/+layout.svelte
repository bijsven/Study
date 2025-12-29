<script lang="ts">
	import "../app.css";
	import favicon from "$lib/assets/favicon.png";
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";

	let { children } = $props();

	onMount(() => {
		if ($page.url.pathname === "/") {
			const visited = localStorage.getItem("visited");

			if (visited) {
				try {
					const visitedGroups = JSON.parse(visited);

					if (
						Array.isArray(visitedGroups) &&
						visitedGroups.length > 0
					) {
						const lastGroupId = visitedGroups[0];
						goto(`/${lastGroupId}`);
					}
				} catch (error) {
					console.error("Error parsing visited data:", error);
				}
			}
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Tussenuren</title>
</svelte:head>

<content class="flex justify-center">
	{@render children?.()}
</content>
