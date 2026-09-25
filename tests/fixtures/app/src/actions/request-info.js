module.exports = async request => ({
    path: request.path,
    query: request.query,
    language: request.language,
    locales: request.locales,
    languageSwitch: !!request.languageSwitch,
    affinity: request.affinity,
    ajaxtype: request.headers['x-ajaxtype'] || null
});
