<script lang="ts">
	import { onMount } from "svelte";
	import { goto } from "$app/navigation";
	import { page } from "$app/stores";
	import { pb } from "$lib";

	let fase = $state(0);
	let user = $state() as any;

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
			console.log("user already exist, falling back");

			record = await pb
				.collection("studyuren")
				.getFirstListItem(`user.id = "${user.id}"`, {
					query: {
						groupId: user.group,
					},
				});
		}
		fase = 3;

		await pb.collection("studyuren").update(
			record?.id!,
			{
				data: localStorage.getItem("sessions"),
			},
			{
				query: {
					groupId: user.group,
				},
			}
		);

		fase = 4;

		localStorage.setItem("user", user.id);
		localStorage.setItem("user:id", record.id);
		localStorage.setItem("username", user.username);
		localStorage.setItem("group", user.group);

		fase = 5;

		goto("/");
	});
</script>

{#if fase >= 0}
	<p>Loaded OK</p>
{/if}
{#if fase >= 1}
	<p>
		User {new URLSearchParams(window.location.search).get("userid")}... OK
	</p>
{/if}
{#if fase >= 2}
	<p>Hi, {user.username}</p>
{/if}
{#if fase >= 3}
	<p>Creating new profile and matching data... OK</p>
{/if}
{#if fase >= 4}
	<p>Syncing data with the server... OK</p>
{/if}
{#if fase >= 5}
	<p>Done!</p>
{/if}
