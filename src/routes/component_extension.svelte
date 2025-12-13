<script lang="ts">
	import { onMount } from "svelte";

	let { extConnected = $bindable(false) } = $props();

	let checkTimeout: number | undefined;

	onMount(() => {
		checkExtension();

		const messageHandler = (event: MessageEvent) => {
			if (event.data?.type === "studyuren:extension:response") {
				console.debug(
					"[Extension] Connection with an extension has been made and the extension is on version:",
					event.data.version
				);
				extConnected = true;

				if (checkTimeout) {
					clearTimeout(checkTimeout);
				}
			}
		};

		window.addEventListener("message", messageHandler);

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
		extConnected = false;

		window.postMessage({ type: "studyuren:extension:request" }, "*");

		if (checkTimeout) {
			clearTimeout(checkTimeout);
		}

		checkTimeout = setTimeout(() => {
			if (!extConnected) {
				console.debug(
					"[Extension] There is no extension currently connected to Studyuren."
				);
			}
		}, 2000);
	}
</script>
