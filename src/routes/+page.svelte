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

	let interval_counter = 0;

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
		background: "nature.jpg",
	});

let sessionStartedAt = $state<number | null>(null);
let checkInState = $state({
	active: false,
	duration: 10,
	startedAt: 0,
	remaining: 10,
});
let checkInInterval: number | undefined;

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
			Math.floor((Date.now() - sessionStartedAt) / 1000)
		);
	}

	async function saveScore(seconds: number) {
		if (seconds < 15) {
			return 0;
		}

		const multiplier = Math.floor(Math.random() * 1) + 1;
		let score = seconds * multiplier;

		multiplier_used = multiplier;

		const data = await pb
			.collection("studyuren")
			.getOne(localStorage.getItem("user:id")!, {
				query: {
					groupId: localStorage.getItem("group")!,
				},
			});

		const existing = data.data || [];

		existing.push({
			duration: seconds,
			multiplier,
			score,
			date: Date.now(),
		});

		finalScore = score;
		showOverlay = true;

		scoreShow = scoreShow + score;

		pb.collection("studyuren").update(
			localStorage.getItem("user:id")!,
			{
				data: JSON.stringify(existing),
			},
			{
				query: {
					groupId: localStorage.getItem("group")!,
				},
			}
		);

		return score;
	}

	onMount(() => {
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
				resolveCheckIn(true);
				if (checkInTimeout) clearTimeout(checkInTimeout);
				scheduleCheckIn();
			}
		});

		(async () => {
			try {
				let i;
				try {
					i = await pb
						.collection("studyuren_live")
						.getFirstListItem(
							"user.id = '" +
								localStorage.getItem("user:id") +
								"'",
							{
								query: {
									groupId: localStorage.getItem("group")!,
								},
							}
						);
				} catch (e) {
					console.log("[Network] Record non-existend");
				}
				if (i) {
					await pb.collection("studyuren_live").delete(i.id!, {
						query: {
							groupId: localStorage.getItem("group")!,
						},
					});
				}

				let item: any;

				item = await pb.collection("studyuren_live").create(
					{
						user: localStorage.getItem("user:id")!,
						ping: new Date().toISOString(),
					},
					{
						query: {
							groupId: localStorage.getItem("group")!,
						},
					}
				);

				setInterval(async () => {
					await pb.collection("studyuren_live").update(
						item.id,
						{
							ping: new Date().toISOString(),
						},
						{
							query: {
								groupId: localStorage.getItem("group")!,
							},
						}
					);
				}, 5000);

				otherOnline = await pb
					.collection("studyuren_live")
					.getFullList({
						filter: `ping > "${new Date(Date.now() - 10 * 1000).toISOString().replace("T", " ").split(".")[0]}"`,
						expand: "user,user.user",
						query: {
							groupId: localStorage.getItem("group")!,
						},
					});

				await pb
					.collection("studyuren_live")
					.subscribe("*", async () => {
						otherOnline = await pb
							.collection("studyuren_live")
							.getFullList({
								filter: `ping > "${new Date(Date.now() - 10 * 1000).toISOString().replace("T", " ").split(".")[0]}"`,
								expand: "user,user.user",
								query: {
									groupId: localStorage.getItem("group")!,
								},
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
			let totalScore = 0;
			const sessionsData = (
				await pb
					.collection("studyuren")
					.getOne(localStorage.getItem("user:id")!, {
						query: {
							groupId: localStorage.getItem("group")!,
						},
					})
			).data;

			if (sessionsData) {
				for (const session of sessionsData) {
					totalScore += session.score;
				}
			}

			if (localStorage.getItem("user")) {
				app.user.id = localStorage.getItem("user") as string;
			}
			if (localStorage.getItem("username")) {
				app.user.name = localStorage.getItem("username") as string;
			}

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

		return () => {
			clearInterval(interval_counter);
			if (checkInTimeout) {
				clearTimeout(checkInTimeout);
			}
			clearCheckInInterval();
		};
	});

	let checkInTimeout: number | undefined;

	function clearCheckInInterval() {
		if (checkInInterval) {
			clearInterval(checkInInterval);
		}
	}

	function triggerCheckIn(duration = 10) {
		if (checkInTimeout) {
			clearTimeout(checkInTimeout);
		}

		const startedAt = Date.now();

		checkInState.active = true;
		checkInState.duration = duration;
		checkInState.startedAt = startedAt;
		checkInState.remaining = duration;
		app.CheckIn = true;

		window.postMessage(
			{ type: "studyuren:check-in-start", duration, startedAt },
			"*"
		);

		clearCheckInInterval();
		checkInInterval = setInterval(() => {
			const remaining = Math.max(
				0,
				Math.ceil(duration - (Date.now() - startedAt) / 1000)
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
		}
	}

	function scheduleCheckIn() {
		if (!app.running) {
			return;
		}

		if (checkInTimeout) {
			clearTimeout(checkInTimeout);
		}

		const delay = Math.random() * (300000 - 10000) + 10000;
		checkInTimeout = setTimeout(() => {
			if (!app.running) return;

			const audio = new Audio("/assets/notification.mp3");
			audio.play();
			triggerCheckIn();
			scheduleCheckIn();
		}, delay);
	}

	$effect(() => {
		const running = app.running;

		if (running) {
		if (!sessionStartedAt) {
			sessionStartedAt = Date.now();
			app.counter = 0;
		}

			if (!localStorage.getItem("hint:extension")) {
				localStorage.setItem("hint:extension", "true");
				showExtensionHint = true;
			}
			image?.classList.remove("animate-zoomout-and-unblur");
			image?.classList.add("animate-zoom-and-blur");

			scheduleCheckIn();

			interval_counter = setInterval(() => {
			syncTimerWithStart();
			}, 1000);

			context?.requestFullscreen?.();
		window.postMessage(
			{ type: "studyuren:start-session", startedAt: sessionStartedAt },
			"*"
		);
		} else {
		if (sessionStartedAt) {
			syncTimerWithStart();
		}

			saveScore(app.counter);
			window.postMessage({ type: "studyuren:end-session" }, "*");

			image?.classList.remove("animate-zoom-and-blur");
			image?.classList.add("animate-zoomout-and-unblur");

			clearInterval(interval_counter);
			if (checkInTimeout) {
				clearTimeout(checkInTimeout);
			}
		clearCheckInInterval();

			app.counter = 0;
		app.CheckIn = false;
		checkInState.active = false;
		sessionStartedAt = null;
			if (document.fullscreenElement) {
				document.exitFullscreen?.();
			}
		}
	});

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

{#if mounted}
	<content
		bind:this={context}
		class="bg-black absolute h-full w-full overflow-hidden"
	>
		<img
			bind:this={image}
			src="/assets/background/{app.background}"
			alt="Background"
			class="object-cover h-full w-full"
		/>
		<div
			class="absolute top-0 left-0 h-full w-full z-10 flex flex-col items-center justify-center text-white text-8xl"
		>
			<div
				class="flex absolute cursor-default gap-1 mb-8 items-center justify-center {app.CheckIn
					? 'animate-unnoticed-zoomout'
					: 'animate-unnoticed-reenter'}"
			>
				{#if formatTime(app.counter)["m"] < 10}
					0
				{/if}
				<NumberFlow value={formatTime(app.counter)["m"]} />
				:{#if formatTime(app.counter)["s"] < 10}0{/if}
				<NumberFlow value={formatTime(app.counter)["s"]} />
			</div>

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
							Installatie van Studyuren Companion
						</h1>
					</div>
					<p class="text-white/50 text-sm text-left">
						1. Installeer de zip vanaf deze <a
							class="underline text-white/70 hover:text-white"
							href="/assets/download/studyuren-companion.zip"
						>
							link
						</a>.<br /> 2. Extract de inhoud van de ZIP en plaats de
						map in Documenten.<br /> 3. Ga naar chrome://extensions
						en klik op "Developer mode" aan de rechterkant.<br /> 4.
						Klik op "Load unpacked" en selecteer de map waar je de
						map "studyuren-companion" hebt geplaatst.<br /> 5. Je hebt
						nu Studyuren Companion geinstalleerd!
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
						duration={checkInState.duration}
						remaining={checkInState.remaining}
						callback={() => resolveCheckIn(false)}
					/>
				{/if}
			</div>

			{#if !app.user.id}
				<a
					href="https://tussenuren.bijsven.nl/connect/studyuren"
					class="text-sm absolute top-16 cursor-pointer duration-200 hover:opacity-100 z-10
				{app.running ? 'opacity-0' : 'opacity-45'}"
					in:fly={{ duration: 500, y: -5 }}
				>
					Inloggen met Tussenuren
				</a>
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
		animation: zoomout-and-unblur 2s cubic-bezier(0.175, 0.885, 0.32, 1.275)
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
