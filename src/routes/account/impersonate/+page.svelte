<script lang="ts">
    import { pb } from "@/index";

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            const input = e.target as HTMLInputElement;
            pb.authStore.save(input.value);

            window.location.href = "/account";
        }
    }
</script>

<input type="text" onkeydown={handleKeydown} placeholder="Enter key" />
