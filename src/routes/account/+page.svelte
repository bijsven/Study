<script lang="ts">
    import { goto } from "$app/navigation";
    import { pb } from "@/index";
    import { Trash } from "@jis3r/icons";
    import { Plus } from "lucide-svelte";
    import { onMount } from "svelte";
    import { fly, fade } from "svelte/transition";

    let appstate = $state(0);
    let loaded = $state(false);

    let email_state = $state(0);
    let email = $state("");
    let ical_data = $state("");

    let groups = $state([]) as any;

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
                    groups.push({
                        id: group,
                        name: (await pb.collection("groups").getOne(group))
                            .name,
                    });
                }
            }
        });
    });
</script>

<svelte:head>
    <title>Account - Study</title>
</svelte:head>

<div
    class="absolute h-full w-full inset-0 top-0 left-0 bg-black overflow-hidden"
>
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
            class="z-10 top-0 overflow-hidden left-0 text-white absolute h-full w-full flex flex-col lg:flex-row justify-center lg:justify-between items-center px-8 lg:px-52"
        >
            {#if appstate == 0}
                <div class="lg:w-96">
                    <p class="text-3xl font-semibold">Welkom terug!</p>
                    <p class="opacity-65 mt-1">
                        bij je Study account. Hiermee krijg je toegang tot
                        Tussen- en Studyuren. Alleen je e-mail is nodig om in te
                        loggen.
                    </p>
                    <div class="mt-4 text-xs">
                        <a
                            href="/account/new"
                            class="mt-4 opacity-65 cursor-pointer hover:opacity-100 hover:scale-101 hover:font-semibold duration-200"
                        >
                            Nieuw account
                        </a>
                        <a
                            href="/migrate"
                            class="mt-4 ml-4 opacity-65 cursor-pointer hover:opacity-100 hover:scale-101 hover:font-semibold duration-200"
                            >Overstappen
                        </a>
                    </div>
                </div>

                <div
                    class="flex flex-col gap-3 lg:mt-0 mt-12 lg:h-128 justify-center items-center overflow-y-auto p-3 min-w-fit"
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
                <div class="lg:w-96">
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
                    <div class="flex flex-col items-start gap-2 mt-3">
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
                        <button
                            onclick={async () => {
                                if (confirm("Account verwijderen?")) {
                                    await pb
                                        .collection("users")
                                        .delete(pb.authStore.record!.id);

                                    pb.authStore.clear();
                                    localStorage.clear();
                                    goto("/");
                                }
                            }}
                            transition:fly={{ duration: 500, y: 5, delay: 150 }}
                            class="text-xs opacity-30 hover:opacity-100 duration-300 hover:text-red-400 hover:font-semibold cursor-pointer"
                        >
                            Account verwijderen
                        </button>
                    </div>
                </div>

                <div
                    transition:fade
                    class="flex flex-col gap-3 lg:h-128 justify-center items-center overflow-y-auto p-3 min-w-fit"
                >
                    <div>
                        <p class="text-sm opacity-65 mb-1 pl-1">Email</p>
                        <div
                            class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                        >
                            <input
                                value={pb.authStore.record!.email}
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
                                value={pb.authStore.record!.username}
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
                                oninput={(() => {
                                    let timeout: ReturnType<
                                        typeof setTimeout
                                    > | null = null;

                                    return () => {
                                        if (timeout) clearTimeout(timeout);

                                        timeout = setTimeout(() => {
                                            if (ical_data.length > 0) {
                                                pb.collection("users").update(
                                                    pb.authStore.record!.id,
                                                    {
                                                        data: {
                                                            somtoday_calendar:
                                                                ical_data,
                                                        },
                                                    },
                                                );
                                            }
                                        }, 300);
                                    };
                                })()}
                                class="h-full w-full rounded-2xl bg-transparent px-5 text-white placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                            />
                        </div>
                    </div>
                    <div class="w-full">
                        <p class="text-sm opacity-65 mb-1 pl-1">Groepen</p>
                        <div class="relative w-full max-w-sm">
                            <details class="relative w-full">
                                <summary
                                    class="flex h-12 cursor-pointer list-none items-center justify-between
                                       rounded-2xl bg-white/10 px-5 text-white/70 shadow-lg
                                       backdrop-blur-md transition hover:bg-white/15 focus:outline-none"
                                >
                                    <span
                                        >{(pb.authStore.record?.groups).length}
                                        groepen</span
                                    >

                                    <svg
                                        class="h-4 w-4 opacity-60 transition
                                           [details[open]_&]:rotate-180"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                    >
                                        <path
                                            fill-rule="evenodd"
                                            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                                            clip-rule="evenodd"
                                        />
                                    </svg>
                                </summary>

                                <div
                                    class="absolute z-50 mt-2 hidden w-full
                                       rounded-2xl border border-white/10 bg-black/70
                                       backdrop-blur-xl shadow-xl
                                       [details[open]_&]:block"
                                >
                                    <ul
                                        class="max-h-[60vh] overflow-y-auto py-2"
                                    >
                                        {#each groups as group}
                                            <li
                                                class="px-5 py-3 text-white/70 transition
                                                   hover:bg-white/10 hover:text-white
                                                   "
                                            >
                                                <div
                                                    class="flex justify-between items-center"
                                                >
                                                    {group.name}
                                                    <button
                                                        onclick={async () => {
                                                            await pb
                                                                .collection(
                                                                    "users",
                                                                )
                                                                .update(
                                                                    pb.authStore
                                                                        .record
                                                                        ?.id!,
                                                                    {
                                                                        groups: pb.authStore.record?.groups.filter(
                                                                            (
                                                                                g: any,
                                                                            ) =>
                                                                                g !=
                                                                                group.id,
                                                                        ),
                                                                    },
                                                                );
                                                            window.location.reload();
                                                        }}
                                                        class="opacity-65 cursor-pointer hover:opacity-100"
                                                    >
                                                        <Trash size={16} />
                                                    </button>
                                                </div>
                                            </li>
                                        {/each}
                                    </ul>

                                    <div
                                        class="border-t border-white/10 px-3 py-3 space-y-2"
                                    >
                                        <a
                                            href="/account/newgroup"
                                            class="flex w-full items-center gap-2 rounded-xl px-3 py-2
                                               text-white/70 transition hover:bg-white/10 hover:text-white"
                                        >
                                            <Plus class="h-4 w-4" />
                                            Groep maken
                                        </a>

                                        <div
                                            class="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2"
                                        >
                                            <span
                                                class="text-sm text-white/50 shrink-0"
                                            >
                                                Deelnemen via code
                                            </span>
                                            <input
                                                onkeydown={async (e) => {
                                                    if (e.key == "Enter") {
                                                        const value = (
                                                            e.currentTarget as HTMLInputElement
                                                        ).value;

                                                        const groups = [
                                                            ...(pb.authStore
                                                                .record
                                                                ?.groups ?? []),
                                                            value,
                                                        ];
                                                        try {
                                                            await pb
                                                                .collection(
                                                                    "users",
                                                                )
                                                                .update(
                                                                    pb.authStore
                                                                        .record
                                                                        ?.id!,
                                                                    {
                                                                        groups,
                                                                    },
                                                                );

                                                            window.location.reload();
                                                        } catch {
                                                            alert(
                                                                "Deze code werkt niet.",
                                                            );
                                                        }
                                                    }
                                                }}
                                                type="text"
                                                placeholder="XXXXXXX"
                                                class="w-full bg-transparent text-sm text-white/80
                                                   placeholder-white/30 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>

                    <div>
                        <p class="text-sm opacity-65 mb-1 pl-1">
                            Account gemaakt op
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
