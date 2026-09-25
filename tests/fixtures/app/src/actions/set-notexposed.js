module.exports = async (request, h) => {
    request.getNotExposedCookie().defineProps(h, {secret: 'value'});
    return {status: 'set'};
};
