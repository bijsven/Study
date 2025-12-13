<script lang="ts">
	import { onMount } from "svelte";

	let { extConnected = $bindable(false) } = $props();

	let checkTimeout: number | undefined;

	onMount(() => {
		console.log("[Extension] Component gemount");

		// Check extensie bij mount
		checkExtension();

		// Luister naar extensie responses
		const messageHandler = (event: MessageEvent) => {
			if (event.data?.type === "studyuren:extension:response") {
				console.log(
					"[Extension] ✅ Verbonden! Versie:",
					event.data.version
				);
				extConnected = true;

				// Clear check timeout want we hebben response
				if (checkTimeout) {
					clearTimeout(checkTimeout);
				}
			}
		};

		window.addEventListener("message", messageHandler);

		// Check elke 10 seconden of extensie nog verbonden is
		const interval = setInterval(() => {
			checkExtension();
		}, 10000);

		return () => {
			window.removeEventListener("message", messageHandler);
			clearInterval(interval);
			if (checkTimeout) {
				clearTimeout(checkTimeout);
			}
		};
	});

	function checkExtension() {
		console.log("[Extension] Check verbinding...");

		// Reset status
		extConnected = false;

		// Stuur verzoek naar content script
		window.postMessage({ type: "studyuren:extension:request" }, "*");

		// Als we na 2 seconden geen response hebben, is extensie niet actief
		if (checkTimeout) {
			clearTimeout(checkTimeout);
		}

		checkTimeout = setTimeout(() => {
			if (!extConnected) {
				console.log("[Extension] ❌ Niet verbonden");
			}
		}, 2000);
	}
</script>
