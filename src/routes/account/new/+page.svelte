<script lang="ts">
    import { goto } from "$app/navigation";
    import { pb } from "@/index";
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";

    let email_state = $state(0);
    let email = $state("");
    let username = $state("");

    async function login() {
        await pb.collection("users").create({
            email: email,
            username: username,
            password: "shallnotbeused",
            passwordConfirm: "shallnotbeused",
            data: {
                somtoday_calendar: "",
            },
        });
        await pb.collection("users").requestOTP(email);
        email_state = 1;
    }

    onMount(() => {
        pb.collection("users").authRefresh();
    });
</script>

<svelte:head>
    <title>Nieuw account - Study</title>
</svelte:head>

<div class="absolute h-full w-full inset-0 top-0 left-0 bg-black">
    <div>
        <img
            src="/assets/background/thumbnails/3.webp"
            alt="background"
            class="h-full w-full object-cover absolute top-0 left-0"
            draggable="false"
            in:fade
        />
        <div
            class="backdrop-blur-xl bg-black/50 inset-0 h-full w-full absolute top-0 left-0"
        ></div>
    </div>

    <div
        class="z-10 top-0 left-0 text-white absolute h-full w-full flex lg:flex-row flex-col justify-center lg:justify-between items-center lg:px-52 px-8"
    >
        <div class="lg:w-96">
            {#if email_state == 0}
                <p class="text-3xl font-semibold">Nieuw account</p>
                <p class="opacity-65 mt-1">
                    met een Study account heb je toegang tot Studyuren,
                    Tussenuren en eventueel later meer. Speciaal gemaakt om
                    studeren fijner te maken.
                </p>
            {:else}
                <p class="text-3xl font-semibold">Check je email</p>
                <p class="opacity-65 mt-1">
                    Je hebt een email ontvangen op <b>{email}</b>. Klik op de
                    link in deze email om je account te activeren.
                </p>
            {/if}
        </div>

        <div
            class="flex flex-col gap-3 lg:h-128 lg:mt-0 mt-12 justify-center items-center overflow-y-auto p-3 min-w-fit"
        >
            <div
                class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
            >
                <!-- svelte-ignore a11y_autofocus -->
                {#if email_state == 0}
                    <input
                        bind:value={username}
                        autofocus
                        maxlength="20"
                        placeholder="Gebruikersnaam"
                        class="h-full w-full rounded-2xl bg-transparent px-5 text-white placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                    />
                {:else}
                    <input
                        in:fly={{ duration: 300, x: 5 }}
                        bind:value={username}
                        placeholder="Gebruikersnaam"
                        disabled
                        class="h-full w-full cursor-not-allowed opacity-65 rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/50 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                    />
                {/if}
            </div>
            <div
                class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
            >
                <!-- svelte-ignore a11y_autofocus -->
                {#if email_state == 0}
                    <input
                        bind:value={email}
                        autofocus
                        placeholder="Email"
                        class="h-full w-full rounded-2xl bg-transparent px-5 text-white placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                    />
                {:else}
                    <input
                        in:fly={{ duration: 300, x: 5 }}
                        bind:value={email}
                        placeholder="Email"
                        disabled
                        class="h-full w-full cursor-not-allowed opacity-65 rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/50 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                    />
                {/if}
            </div>
            {#key email_state}
                <button
                    in:fly={{ duration: 300, y: -5 }}
                    onclick={login}
                    class="text-right w-full opacity-65 duration-300 pr-1 {email_state ==
                    0
                        ? 'cursor-pointer hover:opacity-100'
                        : 'cursor-not-allowed'}"
                >
                    {email_state == 1
                        ? "Check je email!"
                        : "Email verz. & acc. maken"}
                </button>
            {/key}
        </div>
    </div>
</div>
