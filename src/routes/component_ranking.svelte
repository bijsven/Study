<script lang="ts">
	import Zap from "@lucide/svelte/icons/zap";
	import Trophy from "@lucide/svelte/icons/trophy";
	import Medal from "@lucide/svelte/icons/medal";
	import Award from "@lucide/svelte/icons/award";
	import X from "@lucide/svelte/icons/x";
	import { cubicOut } from "svelte/easing";
	import { fly } from "svelte/transition";
	import { onMount } from "svelte";
	import { pb } from "$lib";

	interface Player {
		id: string;
		name: string;
		xp: number;
		streak: number;
		visible: boolean;
	}

	const { callback } = $props();

	let players = $state<Player[]>([]);
	let loading = $state(true);

	onMount(async () => {
		try {
			const groupId = localStorage.getItem("group");
			if (!groupId) {
				console.error("Geen group ID gevonden");
				return;
			}

			const data = await pb.collection("studyuren").getFullList({
				filter: `group.id = "${groupId}"`,
				expand: "user",
				query: {
					groupId: groupId,
				},
			});

			players = data
				.map((record: any) => {
					// Bereken totale XP door alle scores op te tellen
					const totalXP = Array.isArray(record.data)
						? record.data.reduce(
								(sum: number, session: any) =>
									sum + (session.score || 0),
								0
							)
						: 0;

					// Streak is het aantal sessies
					const streak = Array.isArray(record.data)
						? record.data.length
						: 0;

					return {
						id: record.id,
						name: record.expand?.user?.username || "Onbekend",
						xp: totalXP,
						streak: streak,
						visible: false,
					};
				})
				// Sorteer op XP (hoogste eerst)
				.sort((a, b) => b.xp - a.xp);

			// Animeer de spelers één voor één
			players.forEach((_, index) => {
				setTimeout(
					() => {
						players[index].visible = true;
					},
					350 + index * 80
				);
			});
		} catch (error) {
			console.error("Fout bij ophalen leaderboard:", error);
		} finally {
			loading = false;
		}
	});

	function getRankIcon(rank: number) {
		switch (rank) {
			case 1:
				return Trophy;
			case 2:
				return Medal;
			case 3:
				return Award;
			default:
				return null;
		}
	}

	function formatXP(xp: number): string {
		return xp.toLocaleString("nl-NL");
	}
</script>

<button
	onclick={() => callback()}
	in:fly={{ duration: 650, y: -10, easing: cubicOut }}
	out:fly={{ duration: 450, y: 10 }}
	class="absolute top-0 left-0 h-full w-full flex z-50 bg-black/30 backdrop-blur-xl justify-center items-center cursor-pointer"
>
	<div class="flex flex-col items-center gap-6 max-w-md w-full px-6">
		<div class="flex items-center justify-center gap-2 text-white text-2xl">
			<h1 class="font-semibold">Leaderboard</h1>
		</div>

		{#if loading}
			<div class="text-white/50 text-sm">Laden...</div>
		{:else if players.length === 0}
			<div class="text-white/50 text-sm">Nog geen spelers</div>
		{:else}
			<div class="w-full space-y-2">
				{#each players as player, index (player.id)}
					{#if player.visible}
						<div
							in:fly={{ duration: 650, y: -10, easing: cubicOut }}
							class="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
						>
							<div
								class="shrink-0 w-6 flex items-center justify-center"
							>
								{#if getRankIcon(index + 1)}
									{@const IconComponent = getRankIcon(
										index + 1
									)}
									{#if index === 0}
										<IconComponent
											class="w-5 h-5 text-amber-300"
											fill="oklch(87.9% 0.169 91.605)"
										/>
									{:else if index === 1}
										<IconComponent
											class="w-5 h-5 text-slate-300"
										/>
									{:else}
										<IconComponent
											class="w-5 h-5 text-amber-700"
										/>
									{/if}
								{:else}
									<span
										class="text-white/40 text-sm font-medium"
									>
										{index + 1}
									</span>
								{/if}
							</div>

							<div class="flex-1 min-w-0">
								<p
									class="text-white text-sm font-medium truncate text-left"
								>
									{player.name}
								</p>
							</div>

							<div
								class="flex items-center gap-1.5 text-amber-300"
							>
								<Zap
									class="w-3.5 h-3.5"
									fill="oklch(87.9% 0.169 91.605)"
								/>
								<span class="text-sm font-semibold">
									{formatXP(player.xp)}
								</span>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		<p class="text-white/30 text-sm text-center">Klik om te sluiten</p>
	</div>
</button>
