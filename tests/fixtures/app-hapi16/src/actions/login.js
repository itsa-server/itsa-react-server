module.exports = async (request, reply) => {
    const payload = request.payload || {};
    reply.login({user: 'fixture-user', scope: payload.scope || 'user', blocked: !!payload.blocked});
    return {status: 'loggedin'};
};
