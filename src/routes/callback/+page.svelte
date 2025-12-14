<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { pb } from "$lib";
	import { fly } from "svelte/transition";

	let fase = $state(0);
	let user = $state<any>();

	onMount(async () => {
		const params = new URLSearchParams(window.location.search);
		const userId = params.get("userid");
		fase = 1;
		if (!userId) return;

		user = await pb.collection("members").getOne(userId);
		fase = 2;
		if (!user) return;

		let record;

		try {
			record = await pb.collection("studyuren").create(
				{
					group: user.group,
					user: user.id,
					data: [],
				},
				{
					query: {
						groupId: user.group,
					},
				}
			);
		} catch (e) {
			console.log("User already exists, falling back...");

			record = await pb
				.collection("studyuren")
				.getFirstListItem(`user.id = "${user.id}"`, {
					query: {
						groupId: user.group,
					},
				});
		}
		fase = 4;

		localStorage.setItem("user", user.id);
		localStorage.setItem("user:id", record.id);
		localStorage.setItem("username", user.username);
		localStorage.setItem("group", user.group);

		fase = 5;

		goto("/");
	});
</script>

<div class="flex justify-center items-center absolute bg-black h-full w-full">
	<div>
		<h1
			in:fly={{ duration: 500, y: 20 }}
			out:fly={{ duration: 500, y: -20, delay: 250 }}
			class="text-3xl font-semibold text-white falt"
		>
			Tussenuren
		</h1>
		<p
			in:fly={{ duration: 500, y: 10, delay: 250 }}
			out:fly={{ duration: 500, y: -10 }}
			class="falt text-right opacity-65 text-white text-xs"
		>
			Connecting w/ Studyuren ({fase} / 5)
		</p>
	</div>
</div>
