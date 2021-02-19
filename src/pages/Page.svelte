<script>
    import { onMount } from "svelte";
    import { Remarkable } from 'remarkable';
    import { getPage } from '../apis/github.js';

    export let params;

    let md = new Remarkable({
        xhtmlOut: true,
        breaks: true
    });
    let markdown = 'Loading...';

    onMount(async () => {
        const slug = params.slug;
        const res = await getPage(slug);
        markdown = md.render(res);
    });
</script>

<h2>Page component/route</h2>
<p>{ params.slug }</p>
<main class="m-3">
    {@html markdown}
</main>