<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { pb } from "@/index";
    import { onMount } from "svelte";
    import { fade, fly } from "svelte/transition";

    let User = $state() as any;
    let progress = $state(0);
    let progress_finalize = $state("Versturen");
    let users = $state() as any;
    let group = $state();

    onMount(async () => {
        if (pb.authStore.isValid) {
            goto("/");
        }

        const params = new URLSearchParams(window.location.search);
        const data = params.get("data");

        if (data) {
            try {
                const dataset = JSON.parse(decodeURIComponent(data));

                for (const [key, value] of Object.entries(dataset)) {
                    if (typeof value === "string") {
                        localStorage.setItem(key, value);
                    } else {
                        localStorage.setItem(key, JSON.stringify(value));
                    }
                }

                console.log("LocalStorage is hersteld:", dataset);
            } catch (e) {
                console.error("Kon data niet parsen", e);
            }
        }

        if (!sessionStorage.getItem("studyuren:checked")) {
            sessionStorage.setItem("studyuren:checked", "true");
            window.location.href = "https://studyuren.bijsven.nl";
        } else if (!sessionStorage.getItem("tussenuren:checked")) {
            sessionStorage.setItem("tussenuren:checked", "true");
            window.location.href = "https://tussenuren.bijsven.nl";
        }

        if (
            !localStorage.getItem("group") ||
            !localStorage.getItem("visited")![0]
        ) {
            alert(
                "Je was niet ingelogd. Redirecting naar normale inlogpaneel.",
            );
            goto("/account");
        }

        users = await pb.collection("legacy_members").getFullList({
            query: {
                groupId:
                    localStorage.getItem("group")! ||
                    localStorage.getItem("visited")![0],
            },
        });
    });

    async function finalize() {
        progress_finalize = "Gegevens ophalen";

        let user = users.find(
            (user: any) => user.username == User.username,
        ) as {
            id: string;
            group: string;
            username: string;
            ical_link: string;
            migrated: boolean;
        };

        let newUser = {
            password: "shallnotbeused",
            passwordConfirm: "shallnotbeused",
            email: User.email,
            username: User.username,
            data: {
                somtoday_calendar: user.ical_link,
            },
            groups: JSON.parse(localStorage.getItem("visited")!),
        };

        progress_finalize = "Account aanmaken";

        const newUserRec = await pb.collection("users").create(newUser);

        progress_finalize = "Migrating Studyuren data";

        if (localStorage.getItem("user:id")) {
            const old_rec = await pb
                .collection("legacy_studyuren")
                .getOne(localStorage.getItem("user:id")!, {
                    query: {
                        groupId: localStorage.getItem("group")!,
                    },
                });

            for (let i = 0; i < old_rec.data.length; i++) {
                await pb.collection("studyuren").create(
                    {
                        user: newUserRec.id,
                        duration: old_rec.data[i].duration,
                        score: old_rec.data[i].score,
                        date: new Date(old_rec.data[i].date).toISOString(),
                    },
                    {
                        query: {
                            username: newUser.username,
                        },
                    },
                );

                progress_finalize = `Studyuren data (${i}/${old_rec.data.length})`;
            }
        }

        progress_finalize = "Migrating account status";
        await pb.collection("legacy_members").update(
            user.id,
            {
                migrated: true,
            },
            {
                query: {
                    groupId: localStorage.getItem("group")!,
                },
            },
        );

        progress_finalize = "Email verzenden";

        await pb.collection("users").requestOTP(User.email);

        setTimeout(() => {
            progress_finalize = "Klaar!";

            setTimeout(() => {
                progress = 2;
            }, 1000);
        }, 2000);
    }
</script>

<svelte:head>
    <title>Study Migration</title>
</svelte:head>

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
        {#if progress == 0}
            <div class="w-96">
                <p class="text-3xl font-semibold">Selecteer je gebruiker</p>
                <p class="opacity-65 mt-1">
                    Dit is de Study Migrator. Je selecteert je gebruiker en
                    koppelt hem aan een nieuw Study account. Dit kan alleen
                    eenmalig gedaan worden.
                </p>
            </div>

            <div
                class="flex flex-col gap-3 h-128 overflow-y-auto p-3 min-w-fit"
            >
                {#each users as user}
                    {#if user.migrated == false}
                        <button
                            onclick={() => {
                                User = user;
                                progress = 1;
                            }}
                            class="bg-black/45 backdrop-blur-xl w-96 h-16 rounded-xl flex justify-between items-center p-6 cursor-pointer active:scale-99 active:bg-white active:text-black hover:scale-101 duration-100"
                        >
                            <p>{user.username}</p>
                        </button>
                    {:else}
                        <button
                            class="bg-black/45 opacity-40 cursor-not-allowed backdrop-blur-xl w-96 h-16 rounded-xl flex justify-between items-center p-6 duration-100"
                        >
                            <p>{user.username}</p>
                        </button>
                    {/if}
                {/each}
            </div>
        {:else if progress == 1}
            <div class="w-96">
                <p
                    in:fly={{ duration: 500, y: 5 }}
                    class="text-3xl font-semibold"
                >
                    Hey {User.username}!
                </p>
                <p in:fly={{ duration: 500, y: 5 }} class="opacity-65 mt-1">
                    Je bent al bijna klaar, maar voor een Study account hebben
                    wat extra gegevens nodig. Als je je email hebt ingevuld
                    krijg je een email binnen. Klik erop, en je bent klaar!
                </p>
            </div>

            <div
                class="flex flex-col text-left justify-center items-center"
                in:fly={{ duration: 500, y: 5 }}
            >
                <div
                    class="h-12 w-80 overflow-hidden rounded-2xl bg-white/10 shadow-lg backdrop-blur-md"
                >
                    <!-- svelte-ignore a11y_autofocus -->
                    <input
                        onkeydown={(event) => {
                            if (event.key == "Enter") {
                                finalize();
                            }
                        }}
                        bind:value={User.email}
                        autofocus
                        placeholder="Email"
                        class="h-full w-full rounded-2xl bg-transparent px-5 text-white placeholder-white/60 caret-white transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:ring-offset-1 focus:outline-none"
                    />
                </div>
                {#key progress_finalize}
                    <button
                        in:fly={{ duration: 200, y: -5 }}
                        onclick={finalize}
                        class="w-full text-right opacity-65 hover:opacity-100 cursor-pointer duration-200 pt-2 pr-2"
                    >
                        {progress_finalize}
                    </button>
                {/key}
            </div>
        {:else if progress == 2}
            <div class="w-96">
                <p
                    in:fly={{ duration: 500, y: 5 }}
                    class="text-3xl font-semibold"
                >
                    Thanks!
                </p>
                <p in:fly={{ duration: 500, y: 5 }} class="opacity-65 mt-1">
                    Je bent klaar met de overzetting, bedankt voor je hulp. Je
                    kan dit tablad nu sluiten en inloggen met je nieuwe account
                    via jouw email.
                </p>
            </div>
        {/if}
    </div>
</div>
