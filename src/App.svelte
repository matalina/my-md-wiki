<script>
    import Tailwindcss from './Tailwind.svelte';
    import router from "page";
    import Home from './pages/Home.svelte';
    import About from './pages/About.svelte';
    import Page from './pages/Page.svelte';
    import Feed from './pages/Feed.svelte';
    
    let page;

    router('/', () => page = Home);
    router('/about', () => page = About);
    router('/page', () => page = Page);
    router('/feed', () => page = Feed);

    router.start();
</script>
<Tailwindcss />

<h1>Master Layout</h1>

<svelte:component this={page} />