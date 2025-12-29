<script lang="ts">
    import { goto } from "$app/navigation";
    import { pb } from "@/index";
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";

    let appstate = $state(0);
    let loaded = $state(false);

    let email_state = $state(0);
    let email = $state("");
    let ical_data = $state("");

    let groups = $state([]) as string[];

    async function login() {
        await pb.collection("users").requestOTP(email);
        email_state = 1;
    }

    onMount(() => {
        pb.collection("users").authRefresh();

        loaded = true;

        setTimeout(async () => {
            if (pb.authStore.isValid) {
                ical_data = pb.authStore.record!.data.somtoday_calendar;
                appstate = 1;

                for (const group of pb.authStore.record!.groups) {
                    groups.push(
                        (await pb.collection("groups").getOne(group)).name,
                    );
                }
            }
        });
    });
</script>

<svelte:head>
    <title>Account - Study</title>
</svelte:head>

<div class="absolute h-full w-full inset-0 top-0 left-0 bg-black">
    <div>
        <img
            src="/assets/background/3.webp"
            alt="background"
            class="h-full w-full object-cover absolute top-0 left-0"
            draggable="false"
            in:fade
        />
        <div
            class="backdrop-blur-xl bg-black/50 inset-0 h-full w-full absolute top-0 left-0"
        ></div>
    </div>

    {#if loaded}
        <div
            class="z-10 top-0 left-0 text-white absolute h-full w-full flex justify-between items-center px-52"
        >
            {#if appstate == 0}
                <div class="w-96">
                    <p class="text-3xl font-semibold">Welkom terug!</p>
                    <p class="opacity-65 mt-1">
                        bij je Study account. Hiermee krijg je toegang tot
                        Tussen- en Studyuren. Alleen je e-mail is nodig om in te
                        loggen.
                    </p>
                    <button
                        onclick={() => {
                            alert(
                                "Dit is nog niet toegevoegd. Weet je zeker dat je geen oude gebruiker was van Tussenuren? Dan moet je klikken op 'migrate' vanuit daar worden je oude gegevens opgehaald en een nieuw account aangemaakt.",
                            );
                        }}
                        class="mt-4 opacity-65 cursor-pointer hover:opacity-100 hover:scale-101 duration-200"
                    >
                        Nieuw account
                    </button>
                    <a
                        href="/migrate"
                        class="mt-4 ml-4 opacity-65 cursor-pointer hover:opacity-100 hover:scale-101 duration-200"
                        >Overstappen
                    </a>
                </div>

                <div
                    class="flex flex-col gap-3 h-128 justify-center items-center overflow-y-auto p-3 min-w-fit"
                >
                    <div
                        class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                    >
                        <!-- svelte-ignore a11y_autofocus -->
                        {#if email_state == 0}
                            <input
                                onkeydown={(event) => {
                                    if (event.key == "Enter") {
                                        login();
                                    }
                                }}
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
                                ? "Email verzonden - check je email"
                                : "Email verzenden"}
                        </button>
                    {/key}
                </div>
            {:else}
                <div class="w-96">
                    <p
                        transition:fly={{ duration: 300, y: 5 }}
                        class="text-3xl font-semibold"
                    >
                        Mijn account
                    </p>

                    <p
                        transition:fly={{ duration: 500, y: 5, delay: 100 }}
                        class="opacity-80 mt-1"
                    >
                        Dit is je Study account. Hier is Studyuren en Tussenuren
                        aan verbonden. Deze pagina wordt later vernieuwd met
                        meer opties.
                    </p>
                    <div class="flex justify-between items-center mt-3">
                        <a
                            transition:fly={{ duration: 500, y: 5, delay: 150 }}
                            href="/"
                            class="text-xs opacity-30 hover:opacity-100 duration-300 cursor-pointer hover:font-semibold"
                        >
                            Terug
                        </a>

                        <button
                            onclick={() => {
                                pb.authStore.clear();
                                localStorage.clear();

                                goto("/");
                            }}
                            transition:fly={{ duration: 500, y: 5, delay: 150 }}
                            class="text-xs opacity-30 hover:opacity-100 duration-300 hover:text-red-400 hover:font-semibold cursor-pointer"
                        >
                            Uitloggen
                        </button>
                    </div>
                </div>

                <div
                    transition:fade
                    class="flex flex-col gap-3 h-128 justify-center items-center overflow-y-auto p-3 min-w-fit"
                >
                    <div>
                        <p class="text-sm opacity-65 mb-1 pl-1">Email</p>
                        <div
                            class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                        >
                            <input
                                bind:value={pb.authStore.record!.email}
                                placeholder="Email"
                                disabled
                                class="h-full w-full rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <p class="text-sm opacity-65 mb-1 pl-1">
                            Gebruikersnaam
                        </p>
                        <div
                            class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                        >
                            <input
                                bind:value={pb.authStore.record!.username}
                                placeholder="Username"
                                disabled
                                class="h-full w-full rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <p class="text-sm opacity-65 mb-1 pl-1">
                            Somtoday Calendar URL
                        </p>
                        <div
                            class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                        >
                            <input
                                bind:value={ical_data}
                                placeholder="Somtoday Calendar"
                                disabled
                                class="h-full w-full rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <p class="text-sm opacity-65 mb-1 pl-1">Groepen</p>
                        <div
                            class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                        >
                            {#key groups}
                                <input
                                    value={groups.join(", ")}
                                    placeholder="Groups"
                                    disabled
                                    class="h-full w-full rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                                />
                            {/key}
                        </div>
                    </div>
                    <div>
                        <p class="text-sm opacity-65 mb-1 pl-1">
                            Aangemaakt op
                        </p>
                        <div
                            class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                        >
                            <input
                                value={new Date(
                                    pb.authStore.record!.created,
                                ).toLocaleString("nl-NL", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                                placeholder="Somtoday Calendar"
                                disabled
                                class="h-full w-full rounded-2xl bg-transparent px-5 text-white/65 placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                            />
                        </div>
                    </div>
                </div>
            {/if}
        </div>
    {/if}
</div>
