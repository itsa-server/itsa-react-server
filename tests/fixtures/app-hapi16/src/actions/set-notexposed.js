module.exports = async (request, reply) => {
    request.getNotExposedCookie().defineProps(reply, {secret: 'value'});
    return {status: 'set'};
};
