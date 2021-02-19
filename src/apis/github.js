import Api from '../services/api';
import config from '../config.js';

const baseURL = 'https://api.github.com';

export const getHomePage = async () => {
    return await getPage(config.home);
}

export const getContents = async (url) => {
    try {
        const response = await Api.get(url);
        return response;
    } catch (error) {
        console.error(error);
    }
}

export const getPage = async (page) => {
    try {
        const response = await Api.get(`${baseURL}/repos/${config.github_owner}/${config.github_repo}/contents/${page}`);
        let url = response.download_url;
        return await getContents(url);
    } catch (error) {
        console.error(error);
    }
}
