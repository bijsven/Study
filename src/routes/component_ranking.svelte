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
	import NumberFlow, { continuous } from "@number-flow/svelte";

	interface Player {
		id: string;
		name: string;
		xp: number;
		streak: number;
		visible: boolean;
	}

	type TimeFrame = "week" | "month" | "all";

	const { callback } = $props();

	let players = $state<Player[]>([]);
	let loading = $state(true);
	let activeTab = $state<TimeFrame>("all");
	let allData = $state<any[]>([]);

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

			allData = data;
			updatePlayersList("all");
		} catch (error) {
			console.error("Fout bij ophalen leaderboard:", error);
		} finally {
			loading = false;
		}
	});

	function filterDataByTimeFrame(data: any[], timeFrame: TimeFrame) {
		if (timeFrame === "all") return data;

		const now = new Date();
		const cutoffDate = new Date();

		if (timeFrame === "week") {
			cutoffDate.setDate(now.getDate() - 7);
		} else if (timeFrame === "month") {
			cutoffDate.setMonth(now.getMonth() - 1);
		}

		return data.map((record: any) => {
			if (!Array.isArray(record.data)) return record;

			const filteredSessions = record.data.filter((session: any) => {
				if (!session.date) return false;
				const sessionDate = new Date(session.date);
				return sessionDate >= cutoffDate;
			});

			return {
				...record,
				data: filteredSessions,
			};
		});
	}

	function updatePlayersList(timeFrame: TimeFrame) {
		const filteredData = filterDataByTimeFrame(allData, timeFrame);

		players = filteredData
			.map((record: any) => {
				const totalXP = Array.isArray(record.data)
					? record.data.reduce(
							(sum: number, session: any) =>
								sum + (session.score || 0),
							0
						)
					: 0;

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
			.filter((player) => player.xp > 0)
			.sort((a, b) => b.xp - a.xp);
	}

	function setActiveTab(tab: TimeFrame) {
		activeTab = tab;
		updatePlayersList(tab);
	}

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

	function getTabLabel(tab: TimeFrame): string {
		switch (tab) {
			case "week":
				return "Weekelijks";
			case "month":
				return "Maandelijks";
			case "all":
				return "Altijd";
		}
	}
</script>

<div
	role="button"
	tabindex="0"
	in:fly={{ duration: 650, y: -10, easing: cubicOut }}
	out:fly={{ duration: 450, y: 10 }}
	class="absolute top-0 left-0 h-full w-full flex z-50 bg-black/30 backdrop-blur-xl justify-center items-center"
>
	<div class="flex flex-col items-center gap-6 max-w-md w-full px-6">
		<div class="flex items-center justify-center gap-2 text-white text-2xl">
			<h1 class="font-semibold">Leaderboard</h1>
		</div>

		<!-- Tab Navigation -->
		<div
			class="flex gap-2 w-full rounded-xl bg-white/5 p-1 border border-white/10"
			onclick={(e) => {
				e.stopPropagation();
			}}
			role="tablist"
			tabindex="0"
			onkeydown={(e) => {
				e.stopPropagation();
			}}
		>
			{#each ["week", "month", "all"] as tab}
				<button
					onclick={(e) => {
						e.stopPropagation();
						setActiveTab(tab as TimeFrame);
					}}
					class="flex-1 py-2 cursor-pointer px-4 rounded-lg text-sm font-medium transition-all duration-200 {activeTab ===
					tab
						? 'bg-white/10 text-white'
						: 'text-white/50 hover:bg-white/5 hover:text-white/70'}"
				>
					{#if tab === "week"}
						<span>Weekelijks</span>
					{:else if tab === "month"}
						<span>Maandelijks</span>
					{:else if tab === "all"}
						<span>Altijd</span>
					{/if}
				</button>
			{/each}
		</div>

		{#if loading}
			<div class="text-white/50 text-sm">Laden...</div>
		{:else if players.length === 0}
			<div class="text-white/50 text-sm">
				Nog geen spelers in deze periode
			</div>
		{:else}
			<div class="w-full space-y-2">
				{#each players as player, i}
					<div
						in:fly|global={{
							duration: 650,
							y: -10,
							easing: cubicOut,
							delay: i * 100,
						}}
						class="flex items-center gap-4 px-4 py-3 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10"
					>
						<div
							class="shrink-0 w-6 flex items-center justify-center"
						>
							{#if getRankIcon(i + 1)}
								{@const IconComponent = getRankIcon(i + 1)}
								{#if i === 0}
									<IconComponent
										class="w-5 h-5 text-amber-300"
										fill="oklch(87.9% 0.169 91.605)"
									/>
								{:else if i === 1}
									<IconComponent
										class="w-5 h-5 text-slate-300"
									/>
								{:else}
									<IconComponent
										class="w-5 h-5 text-amber-700"
									/>
								{/if}
							{:else}
								<span class="text-white/40 text-sm font-medium">
									{i + 1}
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

						<div class="flex items-center gap-1.5 text-amber-300">
							<Zap
								class="w-3.5 h-3.5"
								fill="oklch(87.9% 0.169 91.605)"
							/>
							<NumberFlow
								value={player.xp}
								class="text-sm font-semibold"
							></NumberFlow>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<button
			onclick={() => {
				callback();
			}}
			class="text-white/30 hover:text-white/70 cursor-pointer duration-300 text-sm text-center"
			>Klik hier om te sluiten</button
		>
	</div>
</div>
