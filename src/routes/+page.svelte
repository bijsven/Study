<script lang="ts">
	import { onMount } from "svelte";
	import { fly } from "svelte/transition";

	import NumberFlow from "@number-flow/svelte";
	import CheckIn from "./component_checkin.svelte";
	import ComponentSessioncompleteoverlay from "./component_sessioncompleteoverlay.svelte";
	import { pb } from "$lib";
	import ComponentRanking from "./component_ranking.svelte";

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
	let fivesec = $state(true);

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

	const formatTime = (time: number) => {
		const h = Math.floor(time / 3600);
		const m = Math.floor((time % 3600) / 60);
		const s = Math.floor(time % 60);

		return { h, m, s };
	};

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

		const existing = JSON.parse(data.data || "[]") || [];

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
				app.CheckIn = false;
			}
		});

		document.addEventListener("fullscreenchange", () => {
			if (!document.fullscreenElement) {
				app.running = false;
			}
		});

		window.addEventListener("blur", () => {
			app.running = false;
		});

		(async () => {
			const i = await pb
				.collection("studyuren_live")
				.getFirstListItem(
					"user.id = '" + localStorage.getItem("user:id") + "'",
					{
						query: {
							groupId: localStorage.getItem("group")!,
						},
					}
				);
			if (i) {
				await pb.collection("studyuren_live").delete(i.id, {
					query: {
						groupId: localStorage.getItem("group")!,
					},
				});
			}

			const item = await pb.collection("studyuren_live").create(
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

			try {
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
			}
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
			fivesec = false;
		}, 5000);

		mounted = true;
	});

	let checkInTimeout: number | undefined;

	function scheduleCheckIn() {
		if (checkInTimeout) {
			clearTimeout(checkInTimeout);
		}

		const delay = Math.random() * (300000 - 10000) + 10000;
		checkInTimeout = setTimeout(() => {
			app.CheckIn = true;
			scheduleCheckIn();
		}, delay);
	}

	$effect(() => {
		if (app.running) {
			image?.classList.remove("animate-zoomout-and-unblur");
			image?.classList.add("animate-zoom-and-blur");

			interval_counter = setInterval(() => {
				app.counter++;
			}, 1000);

			scheduleCheckIn();

			context?.requestFullscreen?.();
		} else {
			saveScore(app.counter);

			image?.classList.remove("animate-zoom-and-blur");
			image?.classList.add("animate-zoomout-and-unblur");

			clearInterval(interval_counter);
			if (checkInTimeout) {
				clearTimeout(checkInTimeout);
			}

			app.counter = 0;
			app.CheckIn = false;
			if (document.fullscreenElement) {
				document.exitFullscreen?.();
			}
		}

		return () => {
			clearInterval(interval_counter);
			if (checkInTimeout) {
				clearTimeout(checkInTimeout);
			}
		};
	});

	$effect(() => {
		safeOnlineUsers = (otherOnline ?? [])
			.map((o: any) => o?.expand?.user?.expand?.user)
			.filter((u: any) => u && u.id !== app.user.id);
	});
</script>

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

			<div class="mt-52">
				{#if app.CheckIn}
					<CheckIn
						callback={() => {
							app.running = false;
						}}
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
			{:else if fivesec}
				<p
					class="text-sm absolute top-16 duration-200
				{app.running ? 'opacity-0' : 'opacity-45'}"
					in:fly={{ duration: 500, y: -5 }}
					out:fly={{ duration: 500, y: -5 }}
				>
					Ingelogd als {app.user.name}
				</p>
			{/if}

			{#if safeOnlineUsers.length > 0}
				<div
					class="text-sm absolute top-16 flex gap-2 items-center justify-center
		cursor-pointer duration-200
		{app.running ? 'opacity-100' : 'opacity-65'}"
					transition:fly={{ duration: 500, y: -5, delay: 5000 }}
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
				class="text-sm absolute bottom-30 z-10 hover:opacity-100 cursor-pointer duration-200
				{app.running ? 'opacity-0' : 'opacity-45'}"
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
		</div>

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
	</content>
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
