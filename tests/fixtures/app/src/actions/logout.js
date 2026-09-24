module.exports = async (request, h) => {
    h.logout();
    return {status: 'loggedout'};
};
