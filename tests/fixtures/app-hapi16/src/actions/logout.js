module.exports = async (request, reply) => {
    reply.logout();
    return {status: 'loggedout'};
};
