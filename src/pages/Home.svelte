<script>
    import config from '../config.js';
    import { onMount } from "svelte";
    import axios from 'axios';
    import { Remarkable } from 'remarkable';

    let md = new Remarkable({
        xhtmlOut: true,
        breaks: true
    });
    
    let markdown = 'Loading...';

    axios({
        method: 'get',
        url: `https://api.github.com/repos/${config.github_owner}/${config.github_repo}/contents/${config.home}`,
    })
        .then(response => {
            let url = response.data.download_url;
            axios({
                method: 'get',
                url,
            })
                .then(response => {
                    markdown = md.render(response.data);
                })
                .catch(error => {
                    console.log(error);
                });
        })
        .catch(error => {
            console.log(error);
        });

</script>
<h2>{@html markdown}</h2>