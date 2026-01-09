<script lang="ts">
    import { onMount } from "svelte";
    import { fly } from "svelte/transition";
    import { page } from "$app/state";
    import { pb } from "@/index";
    import { goto } from "$app/navigation";

    let error = $state("");

    onMount(async () => {
        const id = page.url.searchParams.get("id");
        const data = page.url.searchParams.get("data");

        if (!id || !data) {
            goto("/");
            return;
        }

        try {
            await pb.collection("users").authWithOTP(id, data);
        } catch {
            error = "De code is ongeldig of vervallen. Probeer het opnieuw.";
        }

        if (pb.authStore.isValid) {
            goto("/");
        }
    });
</script>

<div class="absolute h-full w-full inset-0 top-0 left-0">
    <div>
        <img
            src="/assets/background/1.webp"
            alt="background"
            class="h-full w-full object-cover absolute top-0 left-0"
            draggable="false"
        />
        <div
            class="backdrop-blur-3xl bg-black/50 inset-0 h-full w-full absolute top-0 left-0"
        ></div>
    </div>

    <div
        class="z-10 top-0 left-0 text-white absolute h-full w-full flex justify-between items-center px-52"
    >
        <div class="w-96">
            <p in:fly={{ duration: 500, y: 5 }} class="text-3xl font-semibold">
                {error ? "Er ging iets fout" : "Doorsturen"}
            </p>
            <p in:fly={{ duration: 500, y: 5 }} class="opacity-65 mt-1">
                {error
                    ? error
                    : "Welkom terug, we zijn op dit moment je aan het aanmelden en alles goed aan het instellen. Dit zou niet langer dan een seconden moeten duren."}
            </p>
        </div>
    </div>
</div>
