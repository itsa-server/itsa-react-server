module.exports = async (request, h, authCookie) => {
    const props = authCookie.getProps();
    if (request.query.logout==='toolkit') {
        h.logout();
        return false;
    }
    if (!authCookie.isLoggedIn()) {
        return false;
    }
    if (props.blocked) {
        return 'Account blocked';
    }
    return true;
};
