module.exports = async (request, reply, authCookie) => {
    const props = authCookie.getProps();
    if (request.query.logout==='toolkit') {
        reply.logout();
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
