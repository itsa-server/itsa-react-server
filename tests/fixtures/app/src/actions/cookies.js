module.exports = async request => ({
    props: request.getPropsCookie().getProps(),
    bodydata: request.getBodyDataAttrCookie().getProps(),
    notexposed: request.getNotExposedCookie().getProps(),
    globalstate: request.getClientGlobalstate()
});
