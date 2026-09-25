module.exports = async (request, h) => {
    const payload = request.payload || {};
    h.login({user: 'fixture-user', scope: payload.scope || 'user', blocked: !!payload.blocked});
    return {status: 'loggedin'};
};
