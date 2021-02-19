<script>
    import { onMount } from "svelte";
    import { Remarkable } from 'remarkable';
    import { getHomePage } from '../apis/github.js';

    let md = new Remarkable({
        xhtmlOut: true,
        breaks: true
    });
    
    let markdown = 'Loading...';

    onMount(async () => {
        const res = await getHomePage();
        markdown = md.render(res);
    });

</script>
<main class="m-3">
    {@html markdown}
</main>